#!/usr/bin/env python3
"""bible.db에서 장별 마지막 절 번호 테이블을 뽑아 src/constants/chapterLengths.ts로 생성한다.

"장 전체" 판정([#173])에 필요한 값인데, RN에서는 앱 실행 중 bible.db를 조회할 수 없다.
장 개수가 1189개로 작아서(약 10KB) 빌드 타임에 뽑아 번들하는 편이 싸다.

bible.db를 갱신하면 이 스크립트를 다시 돌려야 한다.
__tests__/chapterLengths.test.ts 가 대표 값들을 고정하고 있어 잊으면 테스트가 잡는다.

사용법:
    python3 scripts/build_chapter_lengths.py
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "android/app/src/main/assets/bible.db"
OUT = ROOT / "src/constants/chapterLengths.ts"

QUERY = """
SELECT b.name, v.chapter, MAX(v.verse)
FROM verses v JOIN books b ON v.book_id = b.id
GROUP BY b.name, v.chapter
"""


def main() -> None:
    table: dict[str, dict[str, int]] = {}
    with sqlite3.connect(f"file:{DB}?mode=ro", uri=True) as conn:
        for book, chapter, last_verse in conn.execute(QUERY):
            table.setdefault(book, {})[str(chapter)] = last_verse

    body = json.dumps(table, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "// 이 파일은 scripts/build_chapter_lengths.py 가 bible.db에서 생성한다. 직접 고치지 말 것.\n"
        "// bible.db를 갱신하면 스크립트를 다시 돌려야 한다.\n"
        "//\n"
        "// 책 이름 → 장 번호 → 그 장의 마지막 절 번호.\n"
        "// \"장 전체\" 판정([#173])에 쓴다 — RN은 앱 실행 중 bible.db를 조회할 수 없다.\n"
        f"export const CHAPTER_LENGTHS: Record<string, Record<string, number>> = {body};\n",
        encoding="utf-8",
    )
    chapters = sum(len(v) for v in table.values())
    print(f"생성: {OUT.relative_to(ROOT)}  ({len(table)}권 / {chapters}장 / {OUT.stat().st_size / 1024:.1f}KB)")


if __name__ == "__main__":
    main()
