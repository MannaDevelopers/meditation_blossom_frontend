#!/usr/bin/env python3
"""Convert KorNRV JSON → SQLite bible.db for Android assets.

Usage:
    python3 scripts/build_bible_db.py \
        [--input /path/to/KorNRV.json] \
        [--output android/app/src/main/assets/bible.db] \
        [--source-sha <git-sha>]

Default input: ~/Workspace/bible_databases/sources/ko/KorNRV/KorNRV.json
Default output: android/app/src/main/assets/bible.db
Default source-sha: 'unknown' (caller should pass the bible_databases HEAD sha)
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_INPUT = Path.home() / "Workspace/bible_databases/sources/ko/KorNRV/KorNRV.json"
DEFAULT_OUTPUT = Path("android/app/src/main/assets/bible.db")
SCHEMA_VERSION = "1"
SOURCE_NAME = "KorNRV"


def build(input_path: Path, output_path: Path, source_sha: str) -> None:
    if not input_path.is_file():
        sys.exit(f"Input not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    books = data["books"]
    if len(books) != 66:
        sys.exit(f"Expected 66 books, got {len(books)}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    con = sqlite3.connect(str(output_path))
    try:
        cur = con.cursor()
        cur.execute("PRAGMA journal_mode = DELETE")
        cur.execute("PRAGMA foreign_keys = ON")
        cur.executescript(
            """
            CREATE TABLE books (
                id   INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE verses (
                book_id  INTEGER NOT NULL,
                chapter  INTEGER NOT NULL,
                verse    INTEGER NOT NULL,
                text     TEXT    NOT NULL,
                PRIMARY KEY (book_id, chapter, verse),
                FOREIGN KEY (book_id) REFERENCES books(id)
            ) WITHOUT ROWID;
            CREATE TABLE meta (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )

        verse_rows: list[tuple[int, int, int, str]] = []
        for book_id, book in enumerate(books, start=1):
            cur.execute(
                "INSERT INTO books(id, name) VALUES (?, ?)",
                (book_id, book["name"]),
            )
            for chapter in book["chapters"]:
                for verse in chapter["verses"]:
                    verse_rows.append(
                        (book_id, int(chapter["chapter"]), int(verse["verse"]), verse["text"])
                    )

        cur.executemany(
            "INSERT INTO verses(book_id, chapter, verse, text) VALUES (?, ?, ?, ?)",
            verse_rows,
        )

        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        cur.executemany(
            "INSERT INTO meta(key, value) VALUES (?, ?)",
            [
                ("schema_version", SCHEMA_VERSION),
                ("source", SOURCE_NAME),
                ("source_sha", source_sha),
                ("generated_at", now),
            ],
        )

        con.commit()
        cur.execute("VACUUM")
        con.commit()

        # Sanity check
        total = cur.execute("SELECT COUNT(*) FROM verses").fetchone()[0]
        print(f"Wrote {total} verses across 66 books to {output_path}")
    finally:
        con.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-sha", default=os.environ.get("BIBLE_SOURCE_SHA", "unknown"))
    args = parser.parse_args()
    build(args.input.expanduser(), args.output, args.source_sha)


if __name__ == "__main__":
    main()
