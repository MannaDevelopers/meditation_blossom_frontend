# Bible DB Bundle (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android 측에서 성경 본문을 앱에 번들된 SQLite로 일원화하여, FCM/Firestore에서 온 SermonDto의 content를 DB 본문으로 SSoT 교체.

**Architecture:** KorNRV(개역개정, Public Domain) JSON을 사전 생성 스크립트로 SQLite로 변환하여 `assets/bible.db`에 번들. 앱 실행 시 internal storage로 1회 복사(`meta.source_sha` 기반 재복사). 3-Tier `BibleBookAlias`(ExactMap → Rule Normalize → Hangul Jamo Levenshtein)로 책 이름 해석. `BibleReferenceResolver`가 DTO content에서 참조를 파싱하여 각 range를 `BibleRepository`로 조회하고 `VerseParser` 역파싱 무손실 포맷으로 재조립. `MyFirebaseMessagingService`와 `SermonFirestoreDataSource` 두 진입점에서 DTO 생성 직후 resolver 호출.

**Tech Stack:** Kotlin, Android SQLite (`android.database.sqlite`), Hilt (`@Inject`/`@Binds`), JUnit 4, Python 3(sqlite3, json 표준 라이브러리).

**Spec:** `docs/superpowers/specs/2026-04-17-bible-db-android-design.md`

**Branch:** `feature/issue-74-bible-db-android`

**공통 실행 커맨드 (저장소 루트에서)**
- 단위 테스트: `cd android && ./gradlew :app:testDebugUnitTest`
- 특정 테스트만: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"`
- 계기반 테스트(기기/에뮬레이터 필요): `cd android && ./gradlew :app:connectedDebugAndroidTest`

---

## Task 1: JSON → SQLite 변환 스크립트 및 bible.db 커밋

**Files:**
- Create: `scripts/build_bible_db.py`
- Create: `android/app/src/main/assets/bible.db` (스크립트 실행 결과물, 바이너리)

- [ ] **Step 1: 스크립트 작성**

Create `scripts/build_bible_db.py`:

```python
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
```

- [ ] **Step 2: 스크립트 실행**

Run (from repo root):

```bash
python3 scripts/build_bible_db.py \
  --source-sha "$(git -C ~/Workspace/bible_databases rev-parse HEAD)"
```

Expected stdout:
```
Wrote 31102 verses across 66 books to android/app/src/main/assets/bible.db
```
(총 구절 수는 KorNRV 기준 31,102절이지만 판본에 따라 미세하게 다를 수 있음. 숫자가 달라도 0이 아니고 66권이 모두 들어갔으면 정상.)

- [ ] **Step 3: 결과 DB 검증**

Run:

```bash
sqlite3 android/app/src/main/assets/bible.db \
  "SELECT COUNT(*) FROM books; SELECT COUNT(*) FROM verses; SELECT value FROM meta WHERE key='source';"
```

Expected output:
```
66
<약 31,000>
KorNRV
```

샘플 조회:
```bash
sqlite3 android/app/src/main/assets/bible.db \
  "SELECT verse, text FROM verses WHERE book_id=45 AND chapter=13 AND verse BETWEEN 11 AND 14 ORDER BY verse;"
```
Expected: 로마서 13:11–14 네 구절 출력 (book_id=45 = 로마서).

- [ ] **Step 4: Commit**

```bash
git add scripts/build_bible_db.py android/app/src/main/assets/bible.db
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): bible.db 생성 스크립트 추가 및 assets 번들

KorNRV(개역개정) JSON을 SQLite로 변환하는 1회용 스크립트를 scripts/에
추가하고 결과 bible.db를 android assets에 커밋.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: VerseParser 내부 헬퍼 재사용 가능하게 노출

**Rationale:** `BibleReferenceResolver`가 `BOOK_NAME_REGEX`와 `extractVerseNumbersFromReferenceString`을 재사용하도록 `internal` 가시성으로 승격. 기존 동작 불변.

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/model/VerseParser.kt`

- [ ] **Step 1: 기존 테스트가 통과하는지 baseline 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.data.VerseTest" --tests "app.mannadev.meditation.data.BookNameToVerseRangesTest"
```
Expected: BUILD SUCCESSFUL, 0 failures.

- [ ] **Step 2: 가시성 변경**

Edit `android/app/src/main/java/app/mannadev/meditation/model/VerseParser.kt`:

- `private const val BOOK_NAME_REGEX_PATTERN = ...` → `internal const val BOOK_NAME_REGEX_PATTERN = ...`
- `private val BOOK_NAME_REGEX = Regex(BOOK_NAME_REGEX_PATTERN)` → `internal val BOOK_NAME_REGEX = Regex(BOOK_NAME_REGEX_PATTERN)`
- `private val VERSE_RANGE_REGEX = ...` → `internal val VERSE_RANGE_REGEX = ...`
- `extractVerseNumbersFromReferenceString`은 이미 `@VisibleForTesting` + 기본 public이므로 변경 없음.

다른 코드는 수정하지 않는다.

- [ ] **Step 3: 전체 단위 테스트 재실행**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest
```
Expected: BUILD SUCCESSFUL, 모든 기존 테스트 여전히 통과.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/model/VerseParser.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] refactor(android): VerseParser 정규식 internal로 노출

BibleReferenceResolver 재사용을 위해 BOOK_NAME_REGEX, VERSE_RANGE_REGEX를
internal로 승격. 동작 변경 없음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: BibleDb 인터페이스 + Impl + Hilt 바인딩

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleDb.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleDbImpl.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleDbInitException.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/di/BibleModule.kt`

**Rationale:** interface로 추상화하여 unit test에서는 fake, 계기반 테스트에서는 `BibleDbImpl`을 사용. 기존 프로젝트의 `SermonRepository` 바인딩 패턴과 일치.

- [ ] **Step 1: BibleDbInitException 작성**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleDbInitException.kt`:

```kotlin
package app.mannadev.meditation.data.bible

class BibleDbInitException(message: String, cause: Throwable? = null) : Exception(message, cause)
```

- [ ] **Step 2: BibleDb 인터페이스 작성**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleDb.kt`:

```kotlin
package app.mannadev.meditation.data.bible

interface BibleDb {
    /** books.name → books.id 전체 매핑. Repository 초기화 시 1회 로드. */
    fun loadBookIdByName(): Map<String, Int>

    /** 단일 범위 조회. ORDER BY verse ASC. 빈 결과도 정상(상위에서 처리). */
    fun queryRange(bookId: Int, chapter: Int, startVerse: Int, endVerse: Int): List<VerseRow>

    data class VerseRow(val verse: Int, val text: String)
}
```

- [ ] **Step 3: BibleDbImpl 작성 (asset copy + version 비교 + read-only open)**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleDbImpl.kt`:

```kotlin
package app.mannadev.meditation.data.bible

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import app.mannadev.meditation.analytics.CrashlyticsHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleDbImpl @Inject constructor(
    @ApplicationContext private val context: Context,
) : BibleDb {

    private val lock = Any()
    @Volatile private var openedDb: SQLiteDatabase? = null

    private fun ensureOpen(): SQLiteDatabase {
        openedDb?.let { return it }
        synchronized(lock) {
            openedDb?.let { return it }
            val target = context.getDatabasePath(DB_NAME).apply {
                parentFile?.mkdirs()
            }
            copyFromAssetsIfNeeded(target)
            val db = try {
                SQLiteDatabase.openDatabase(target.path, null, SQLiteDatabase.OPEN_READONLY)
            } catch (e: Exception) {
                Timber.e(e, "Failed to open bible.db at %s", target.path)
                CrashlyticsHelper.recordException(e, "BibleDbImpl.openDatabase failed")
                throw BibleDbInitException("openDatabase failed: ${target.path}", e)
            }
            openedDb = db
            return db
        }
    }

    private fun copyFromAssetsIfNeeded(target: File) {
        val assetSha = readAssetMeta("source_sha")
        val assetSchema = readAssetMeta("schema_version")
        if (target.exists()) {
            val current = runCatching { readFileMeta(target, "source_sha") }.getOrNull()
            val currentSchema = runCatching { readFileMeta(target, "schema_version") }.getOrNull()
            if (current == assetSha && currentSchema == assetSchema) return
            // asset 쪽이 달라졌으면 기존 DB 제거 후 재복사
            target.delete()
        }
        try {
            context.assets.open(DB_NAME).use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to copy bible.db from assets")
            CrashlyticsHelper.recordException(e, "BibleDbImpl.copyFromAssets failed")
            throw BibleDbInitException("copyFromAssets failed", e)
        }
    }

    private fun readAssetMeta(key: String): String? {
        val tmp = File.createTempFile("bible-asset-meta", ".db", context.cacheDir)
        try {
            context.assets.open(DB_NAME).use { input ->
                tmp.outputStream().use { output -> input.copyTo(output) }
            }
            return readFileMeta(tmp, key)
        } catch (e: Exception) {
            Timber.w(e, "Failed to read asset meta key=%s", key)
            return null
        } finally {
            tmp.delete()
        }
    }

    private fun readFileMeta(file: File, key: String): String? {
        val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
        try {
            db.rawQuery("SELECT value FROM meta WHERE key = ?", arrayOf(key)).use { c ->
                return if (c.moveToFirst()) c.getString(0) else null
            }
        } finally {
            db.close()
        }
    }

    override fun loadBookIdByName(): Map<String, Int> {
        val db = ensureOpen()
        val map = LinkedHashMap<String, Int>(66)
        db.rawQuery("SELECT id, name FROM books", null).use { c ->
            while (c.moveToNext()) {
                map[c.getString(1)] = c.getInt(0)
            }
        }
        return map
    }

    override fun queryRange(
        bookId: Int,
        chapter: Int,
        startVerse: Int,
        endVerse: Int,
    ): List<BibleDb.VerseRow> {
        val db = ensureOpen()
        val rows = ArrayList<BibleDb.VerseRow>(endVerse - startVerse + 1)
        db.rawQuery(
            "SELECT verse, text FROM verses WHERE book_id = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse",
            arrayOf(bookId.toString(), chapter.toString(), startVerse.toString(), endVerse.toString()),
        ).use { c ->
            while (c.moveToNext()) {
                rows.add(BibleDb.VerseRow(verse = c.getInt(0), text = c.getString(1)))
            }
        }
        return rows
    }

    companion object {
        const val DB_NAME = "bible.db"
    }
}
```

- [ ] **Step 4: Hilt 모듈 작성**

Create `android/app/src/main/java/app/mannadev/meditation/di/BibleModule.kt`:

```kotlin
package app.mannadev.meditation.di

import androidx.annotation.Keep
import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleDbImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Keep
@Module
@InstallIn(SingletonComponent::class)
abstract class BibleModule {

    @Binds
    @Singleton
    abstract fun bindBibleDb(impl: BibleDbImpl): BibleDb
}
```

- [ ] **Step 5: 빌드 확인 (컴파일만, 테스트 없음)**

Run:
```bash
cd android && ./gradlew :app:compileDebugKotlin
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/bible/ \
        android/app/src/main/java/app/mannadev/meditation/di/BibleModule.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): BibleDb 인터페이스·Impl·Hilt 바인딩 추가

assets/bible.db를 internal storage로 복사하고 read-only로 open.
meta.source_sha/schema_version 비교로 asset 교체 시 재복사.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: BibleBookAlias Tier 1 (ExactMap)

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/BookAliasNotFoundException.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt`
- Create: `android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt`

- [ ] **Step 1: 예외 타입 작성**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/BookAliasNotFoundException.kt`:

```kotlin
package app.mannadev.meditation.data.bible

class BookAliasNotFoundException(val input: String)
    : IllegalArgumentException("Unknown bible book: '$input'")
```

- [ ] **Step 2: Tier 1 실패 테스트 작성**

Create `android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt`:

```kotlin
package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleBookAlias
import app.mannadev.meditation.data.bible.BookAliasNotFoundException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BibleBookAliasTest {

    @Test fun `tier1 exact map resolves known standard names`() {
        assertEquals("창세기", BibleBookAlias.resolve("창세기"))
        assertEquals("요한1서", BibleBookAlias.resolve("요한1서"))
        assertEquals("고린도전서", BibleBookAlias.resolve("고린도전서"))
    }

    @Test fun `tier1 exact map resolves common hangul number variants`() {
        assertEquals("요한1서", BibleBookAlias.resolve("요한일서"))
        assertEquals("요한2서", BibleBookAlias.resolve("요한이서"))
        assertEquals("요한3서", BibleBookAlias.resolve("요한삼서"))
    }

    @Test fun `tier1 exact map resolves compact variants`() {
        assertEquals("요한1서", BibleBookAlias.resolve("1요한"))
        assertEquals("요한1서", BibleBookAlias.resolve("요1"))
    }

    @Test fun `unknown input throws`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            BibleBookAlias.resolve("이상한책명")
        }
    }
}
```

- [ ] **Step 3: 실패 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"
```
Expected: 컴파일 실패 또는 test 실패(클래스 없음).

- [ ] **Step 4: BibleBookAlias Tier 1만 구현**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt`:

```kotlin
package app.mannadev.meditation.data.bible

/**
 * 입력된 책 이름을 KorNRV 표준 표기(`books.name`)로 해석한다.
 *
 * 해석 순서:
 *   Tier 1: ExactMap (이 파일)
 *   Tier 2: 규칙 기반 정규화 (Task 5)
 *   Tier 3: 한글 자모 기반 fuzzy match (Task 6)
 *
 * 어떤 Tier도 매치하지 못하면 [BookAliasNotFoundException].
 */
object BibleBookAlias {

    /** KorNRV 66권 표준 표기. Tier 3 candidate 및 정답 검증에 사용. */
    val STANDARD_NAMES: List<String> = listOf(
        "창세기", "출애굽기", "레위기", "민수기", "신명기",
        "여호수아", "사사기", "룻기",
        "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하",
        "에스라", "느헤미야", "에스더",
        "욥기", "시편", "잠언", "전도서", "아가",
        "이사야", "예레미야", "예레미야애가", "에스겔", "다니엘",
        "호세아", "요엘", "아모스", "오바댜", "요나", "미가",
        "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기",
        "마태복음", "마가복음", "누가복음", "요한복음",
        "사도행전", "로마서",
        "고린도전서", "고린도후서", "갈라디아서", "에베소서", "빌립보서", "골로새서",
        "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "디도서", "빌레몬서",
        "히브리서", "야고보서", "베드로전서", "베드로후서",
        "요한1서", "요한2서", "요한3서",
        "유다서", "요한계시록",
    )

    private val standardSet: Set<String> = STANDARD_NAMES.toSet()

    private val exactMap: Map<String, String> = buildMap {
        // 표준명 그대로
        STANDARD_NAMES.forEach { put(it, it) }
        // 한글 숫자 ↔ 아라비아 숫자 (요한1/2/3서는 KorNRV가 아라비아)
        put("요한일서", "요한1서"); put("요한이서", "요한2서"); put("요한삼서", "요한3서")
        // 전/후 ↔ 일/이 (고린도·데살로니가·디모데·베드로 등)
        put("고린도일서", "고린도전서"); put("고린도이서", "고린도후서")
        put("데살로니가일서", "데살로니가전서"); put("데살로니가이서", "데살로니가후서")
        put("디모데일서", "디모데전서"); put("디모데이서", "디모데후서")
        put("베드로일서", "베드로전서"); put("베드로이서", "베드로후서")
        // 1요한/2요한 같은 숫자 접두 표기
        put("1요한", "요한1서"); put("2요한", "요한2서"); put("3요한", "요한3서")
        put("1고린도", "고린도전서"); put("2고린도", "고린도후서")
        put("1데살로니가", "데살로니가전서"); put("2데살로니가", "데살로니가후서")
        put("1디모데", "디모데전서"); put("2디모데", "디모데후서")
        put("1베드로", "베드로전서"); put("2베드로", "베드로후서")
        put("1사무엘", "사무엘상"); put("2사무엘", "사무엘하")
        put("1열왕기", "열왕기상"); put("2열왕기", "열왕기하")
        put("1역대", "역대상"); put("2역대", "역대하")
        // 초단축 표기
        put("요1", "요한1서"); put("요2", "요한2서"); put("요3", "요한3서")
    }

    fun resolve(input: String): String {
        val t1 = exactMap[input]
        if (t1 != null) return t1
        throw BookAliasNotFoundException(input)
    }

    internal fun isStandard(name: String): Boolean = name in standardSet
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"
```
Expected: 4 tests, BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/bible/BookAliasNotFoundException.kt \
        android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt \
        android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): BibleBookAlias Tier 1 ExactMap 추가

66권 KorNRV 표준명 + 흔한 변형(한글숫자·숫자접두·축약)을 직접 매핑.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: BibleBookAlias Tier 2 (규칙 기반 정규화)

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt`
- Modify: `android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt`

- [ ] **Step 1: Tier 2 실패 테스트 추가**

Edit `android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt` — `BibleBookAliasTest` 클래스 안에 추가:

```kotlin
    @Test fun `tier2 strips whitespace and punctuation`() {
        assertEquals("요한1서", BibleBookAlias.resolve("  요한 1 서  "))
        assertEquals("요한1서", BibleBookAlias.resolve("요한.1서"))
        assertEquals("로마서", BibleBookAlias.resolve("(로마서)"))
    }

    @Test fun `tier2 converts hangul digits to arabic for john epistles`() {
        assertEquals("요한1서", BibleBookAlias.resolve("요한 일 서"))
    }

    @Test fun `tier2 appends missing suffix`() {
        // KorNRV는 "로마서"/"요한복음" 등 접미사를 사용. "로마"만 왔을 때도 해석
        assertEquals("로마서", BibleBookAlias.resolve("로마"))
        assertEquals("요한복음", BibleBookAlias.resolve("요한"))  // 주의: "요한"만 단독은 복음으로 해석 (ExactMap에 없으므로 Tier 2에서 접미사 보완)
    }
```

Note: 마지막 케이스("요한" 단독 → 요한복음)은 모호함이 있다. FCM 실제 데이터는 항상 `복음`/`서` 접미사를 포함하므로 이 테스트는 **Tier 2가 접미사 보완을 시도한다는 동작의 확인**에 그친다. 실제 데이터에서 단독 "요한"이 들어오는 일은 없다.

- [ ] **Step 2: 실패 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"
```
Expected: 추가된 3개 테스트 실패.

- [ ] **Step 3: Tier 2 구현**

Edit `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt`:

`resolve` 함수를 아래로 교체하고, 파일 하단에 헬퍼 함수를 추가:

```kotlin
    fun resolve(input: String): String {
        exactMap[input]?.let { return it }

        val normalized = normalizeForTier2(input)
        exactMap[normalized]?.let { return it }

        // 접미사 보완: "로마" → "로마서", "요한" → "요한복음"
        for (suffix in listOf("서", "복음", "기", "상", "하", "계시록")) {
            val candidate = normalized + suffix
            exactMap[candidate]?.let { return it }
        }

        throw BookAliasNotFoundException(input)
    }

    private fun normalizeForTier2(raw: String): String {
        val stripped = raw.replace(WHITESPACE_OR_PUNCT, "")
        return HANGUL_DIGIT_REPLACE.entries.fold(stripped) { acc, (k, v) -> acc.replace(k, v) }
    }

    private val WHITESPACE_OR_PUNCT = Regex("[\\s.,()\\[\\]<>\\-_/]")
    private val HANGUL_DIGIT_REPLACE: Map<String, String> = mapOf(
        "일" to "1", "이" to "2", "삼" to "3", "사" to "4",
    )
```

위 치환은 "요한일서"가 "요한1서"로 정규화된 뒤 exactMap에서 히트. 접미사 보완은 Map hit까지 시도 후 마지막으로 예외.

**주의:** "이사야", "사사기", "다니엘"처럼 한글숫자 글자를 책명에 포함한 경우 Tier 1에서 이미 히트하므로 Tier 2로 내려오지 않는다(`exactMap[input]?.let { return it }`이 먼저). 따라서 Tier 2 내의 "일/이/삼 → 1/2/3" 치환이 책명 본체를 망가뜨릴 걱정 없음.

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"
```
Expected: 모든 테스트(Task 4 + Task 5) 통과.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt \
        android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): BibleBookAlias Tier 2 규칙 정규화 추가

공백·구두점 제거, 일/이/삼/사 → 1/2/3/4 치환, 누락 접미사 보완 후
Tier 1 map 재조회.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: BibleBookAlias Tier 3 (한글 자모 Levenshtein)

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt`
- Modify: `android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt`

**Approach:** 한글 완성형 음절을 초/중/종성 자모 시퀀스로 분해하여 Levenshtein distance 계산. 66권 표준명 중 최소 거리 후보가 threshold 이하면 채택. Threshold는 실험 후 결정 — 초안은 자모 길이 기준 **절대 거리 ≤ 2** (책명이 짧아 1자 오타 정도만 허용).

- [ ] **Step 1: Tier 3 실패 테스트 추가**

Edit `android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt` — 추가:

```kotlin
    @Test fun `tier3 fuzzy matches single-char typo`() {
        // "로마서" → "노마서" (ㄹ→ㄴ, 1자 오타)
        assertEquals("로마서", BibleBookAlias.resolve("노마서"))
        // "요한복음" → "요환복음" (ㅏ→ㅘ)
        assertEquals("요한복음", BibleBookAlias.resolve("요환복음"))
    }

    @Test fun `tier3 rejects too-distant input`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            BibleBookAlias.resolve("이건전혀다른이름입니다")
        }
    }
```

- [ ] **Step 2: 실패 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"
```
Expected: Tier 3 테스트 실패(오타 케이스가 Tier 1/2 miss → 예외).

- [ ] **Step 3: Tier 3 구현 (자모 분해 + Levenshtein)**

Edit `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt`:

`resolve` 함수 마지막 `throw` 직전에 Tier 3 호출을 삽입하고, 파일 하단에 헬퍼 추가:

```kotlin
    fun resolve(input: String): String {
        exactMap[input]?.let { return it }

        val normalized = normalizeForTier2(input)
        exactMap[normalized]?.let { return it }

        for (suffix in listOf("서", "복음", "기", "상", "하", "계시록")) {
            val candidate = normalized + suffix
            exactMap[candidate]?.let { return it }
        }

        tier3Fuzzy(normalized)?.let { return it }

        throw BookAliasNotFoundException(input)
    }

    private const val FUZZY_MAX_DISTANCE = 2

    internal fun tier3Fuzzy(normalizedInput: String): String? {
        val inputJamo = toJamoSequence(normalizedInput)
        var bestName: String? = null
        var bestDistance = Int.MAX_VALUE
        for (name in STANDARD_NAMES) {
            val candidateJamo = toJamoSequence(name)
            val d = levenshtein(inputJamo, candidateJamo, upperBound = FUZZY_MAX_DISTANCE)
            if (d < bestDistance) {
                bestDistance = d
                bestName = name
                if (d == 0) break
            }
        }
        return if (bestDistance <= FUZZY_MAX_DISTANCE) bestName else null
    }

    /** 한글 음절(AC00-D7A3)을 초/중/종성 자모로 분해. 그 외 문자는 그대로 1원소. */
    internal fun toJamoSequence(s: String): IntArray {
        val out = IntArray(s.length * 3)
        var idx = 0
        for (ch in s) {
            val code = ch.code
            if (code in 0xAC00..0xD7A3) {
                val base = code - 0xAC00
                val cho = base / (21 * 28)                  // 0..18
                val jung = (base % (21 * 28)) / 28          // 0..20
                val jong = base % 28                        // 0..27 (0 = 종성 없음)
                out[idx++] = 0x1100 + cho
                out[idx++] = 0x1161 + jung
                if (jong != 0) out[idx++] = 0x11A7 + jong
            } else {
                out[idx++] = code
            }
        }
        return out.copyOf(idx)
    }

    /** 표준 Levenshtein. upperBound 초과가 확정되면 Int.MAX_VALUE 반환(조기 종료). */
    internal fun levenshtein(a: IntArray, b: IntArray, upperBound: Int): Int {
        val n = a.size; val m = b.size
        if (kotlin.math.abs(n - m) > upperBound) return Int.MAX_VALUE
        if (n == 0) return m
        if (m == 0) return n
        val prev = IntArray(m + 1) { it }
        val curr = IntArray(m + 1)
        for (i in 1..n) {
            curr[0] = i
            var rowMin = curr[0]
            for (j in 1..m) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                curr[j] = minOf(
                    prev[j] + 1,        // deletion
                    curr[j - 1] + 1,    // insertion
                    prev[j - 1] + cost, // substitution
                )
                if (curr[j] < rowMin) rowMin = curr[j]
            }
            if (rowMin > upperBound) return Int.MAX_VALUE
            System.arraycopy(curr, 0, prev, 0, m + 1)
        }
        return prev[m]
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleBookAliasTest"
```
Expected: 모든 테스트(Task 4–6) 통과. Tier 3 오타 케이스 pass, 너무 먼 입력 reject.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/bible/BibleBookAlias.kt \
        android/app/src/test/java/app/mannadev/meditation/bible/BibleBookAliasTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): BibleBookAlias Tier 3 Hangul Levenshtein 추가

한글 음절을 초/중/종성 자모로 분해 후 66권 표준명과 Levenshtein
거리 계산. FUZZY_MAX_DISTANCE=2 초안.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: BibleRepository (bookId 캐싱 + 범위 조회)

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleRepository.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/bible/VerseRangeNotFoundException.kt`
- Create: `android/app/src/test/java/app/mannadev/meditation/bible/BibleRepositoryTest.kt`

- [ ] **Step 1: 예외 타입 작성**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/VerseRangeNotFoundException.kt`:

```kotlin
package app.mannadev.meditation.data.bible

class VerseRangeNotFoundException(
    val book: String,
    val chapter: Int,
    val startVerse: Int,
    val endVerse: Int,
) : NoSuchElementException("No verses for $book $chapter:$startVerse-$endVerse")
```

- [ ] **Step 2: 실패 테스트 작성**

Create `android/app/src/test/java/app/mannadev/meditation/bible/BibleRepositoryTest.kt`:

```kotlin
package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.data.bible.BookAliasNotFoundException
import app.mannadev.meditation.data.bible.VerseRangeNotFoundException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BibleRepositoryTest {

    private class FakeBibleDb(
        private val books: Map<String, Int>,
        private val verses: Map<Triple<Int, Int, Int>, String>,
    ) : BibleDb {
        override fun loadBookIdByName(): Map<String, Int> = books
        override fun queryRange(
            bookId: Int, chapter: Int, startVerse: Int, endVerse: Int,
        ): List<BibleDb.VerseRow> =
            (startVerse..endVerse).mapNotNull { v ->
                verses[Triple(bookId, chapter, v)]?.let { BibleDb.VerseRow(v, it) }
            }
    }

    private fun repo(): BibleRepository {
        val db = FakeBibleDb(
            books = mapOf("로마서" to 45, "요한1서" to 62),
            verses = mapOf(
                Triple(45, 13, 11) to "또한 너희가",
                Triple(45, 13, 12) to "밤이 깊고",
                Triple(45, 13, 13) to "낮에와 같이",
                Triple(45, 13, 14) to "오직 주",
                Triple(62, 1, 1) to "태초부터 있는",
            ),
        )
        return BibleRepository(db)
    }

    @Test fun `returns verses in order for standard name`() {
        val rows = repo().getRange("로마서", 13, 11, 14)
        assertEquals(4, rows.size)
        assertEquals(11, rows[0].verse)
        assertEquals("또한 너희가", rows[0].text)
        assertEquals(14, rows[3].verse)
    }

    @Test fun `resolves alias before query`() {
        val rows = repo().getRange("요한일서", 1, 1, 1)
        assertEquals(1, rows.size)
        assertEquals("태초부터 있는", rows[0].text)
    }

    @Test fun `empty result throws VerseRangeNotFoundException`() {
        assertThrows(VerseRangeNotFoundException::class.java) {
            repo().getRange("로마서", 99, 1, 3)
        }
    }

    @Test fun `unknown book throws BookAliasNotFoundException`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            repo().getRange("전혀모르는책", 1, 1, 1)
        }
    }
}
```

- [ ] **Step 3: 실패 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleRepositoryTest"
```
Expected: 컴파일 실패(BibleRepository 미존재).

- [ ] **Step 4: BibleRepository 구현**

Create `android/app/src/main/java/app/mannadev/meditation/data/bible/BibleRepository.kt`:

```kotlin
package app.mannadev.meditation.data.bible

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleRepository @Inject constructor(
    private val db: BibleDb,
) {
    @Volatile private var bookIdByName: Map<String, Int>? = null

    private fun bookIds(): Map<String, Int> {
        bookIdByName?.let { return it }
        return synchronized(this) {
            bookIdByName ?: db.loadBookIdByName().also { bookIdByName = it }
        }
    }

    /** alias 해석 → bookId 조회 → DB 범위 조회. 빈 결과는 [VerseRangeNotFoundException]. */
    fun getRange(bookName: String, chapter: Int, startVerse: Int, endVerse: Int): List<BibleDb.VerseRow> {
        val canonical = BibleBookAlias.resolve(bookName)
        val bookId = bookIds()[canonical]
            ?: throw BookAliasNotFoundException(bookName)
        val rows = db.queryRange(bookId, chapter, startVerse, endVerse)
        if (rows.isEmpty()) throw VerseRangeNotFoundException(canonical, chapter, startVerse, endVerse)
        return rows
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleRepositoryTest"
```
Expected: 4 tests, BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/bible/BibleRepository.kt \
        android/app/src/main/java/app/mannadev/meditation/data/bible/VerseRangeNotFoundException.kt \
        android/app/src/test/java/app/mannadev/meditation/bible/BibleRepositoryTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): BibleRepository 추가

BibleBookAlias로 이름 해석 후 bookId 캐시를 경유하여 DB 범위 조회.
빈 결과는 VerseRangeNotFoundException.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: BibleReferenceResolver (content 재구성 + resolveDto)

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt`
- Create: `android/app/src/test/java/app/mannadev/meditation/bible/BibleReferenceResolverTest.kt`

**Parsing design**
- `VerseParser.BOOK_NAME_REGEX`로 prefix("본문 :") + 참조 토큰 추출.
- 참조 토큰을 `,` 로 분할. 각 파트에서 책명과 `장:시작[-끝]` 분리.
  - 파트 정규식: `^(?<book>[^\d\s]+)?\s*(?<chapter>\d+):(?<start>\d+)(?:-(?<end>\d+))?$`
  - 책명이 없으면 직전 책명 상속.
- 각 range를 `BibleRepository.getRange`로 조회하여 `List<VerseRow>`를 순서대로 concat.
- 재조립 규약(VerseParser 역파싱 호환):
  - prefix가 있었으면 `"본문 : "` 그대로 유지(원 문자열의 prefix 복제), 없었으면 참조부터 시작.
  - 참조 문자열은 원본 그대로 유지(공백/쉼표 포함).
  - 전체 구절 수 ≥ 2면 각 절 앞에 `"{verse} "` prefix. 전체 구절 수 = 1이면 번호 없이 본문만.
  - 참조와 본문 사이, 절 사이는 단일 공백.

- [ ] **Step 1: 실패 테스트 작성**

Create `android/app/src/test/java/app/mannadev/meditation/bible/BibleReferenceResolverTest.kt`:

```kotlin
package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
import app.mannadev.meditation.model.VerseParser
import org.junit.Assert.assertEquals
import org.junit.Test

class BibleReferenceResolverTest {

    private class FakeBibleDb(
        private val books: Map<String, Int>,
        private val verses: Map<Triple<Int, Int, Int>, String>,
    ) : BibleDb {
        override fun loadBookIdByName() = books
        override fun queryRange(bookId: Int, chapter: Int, startVerse: Int, endVerse: Int) =
            (startVerse..endVerse).mapNotNull { v ->
                verses[Triple(bookId, chapter, v)]?.let { BibleDb.VerseRow(v, it) }
            }
    }

    private fun resolver(): BibleReferenceResolver {
        val db = FakeBibleDb(
            books = mapOf("창세기" to 1, "신명기" to 5, "로마서" to 45, "요한복음" to 43, "요한1서" to 62),
            verses = mapOf(
                Triple(1, 22, 2) to "여호와께서 이르시되",
                Triple(5, 34, 4) to "이는 내가 아브라함과",
                Triple(45, 13, 11) to "또한 너희가",
                Triple(45, 13, 12) to "밤이 깊고",
                Triple(45, 13, 13) to "낮에와 같이",
                Triple(45, 13, 14) to "오직 주",
                Triple(43, 3, 16) to "하나님이 세상을",
                Triple(43, 3, 30) to "그는 흥하여야",
                Triple(62, 1, 1) to "태초부터 있는",
            ),
        )
        return BibleReferenceResolver(BibleRepository(db))
    }

    @Test fun `single range with prefix`() {
        val out = resolver().resolveContent("본문 : 로마서 13:11-14 기존본문무시")
        assertEquals(
            "본문 : 로마서 13:11-14 11 또한 너희가 12 밤이 깊고 13 낮에와 같이 14 오직 주",
            out,
        )
    }

    @Test fun `single verse drops number prefix`() {
        val out = resolver().resolveContent("본문 : 요한복음 3:16 옛 본문")
        assertEquals("본문 : 요한복음 3:16 하나님이 세상을", out)
    }

    @Test fun `multi range across books with book names`() {
        val out = resolver().resolveContent(
            "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 옛본문"
        )
        assertEquals(
            "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 2 여호와께서 이르시되 4 이는 내가 아브라함과 30 그는 흥하여야",
            out,
        )
    }

    @Test fun `no prefix is preserved as missing`() {
        val out = resolver().resolveContent("로마서 13:11-14 본문")
        assertEquals(
            "로마서 13:11-14 11 또한 너희가 12 밤이 깊고 13 낮에와 같이 14 오직 주",
            out,
        )
    }

    @Test fun `alias is resolved via repository`() {
        val out = resolver().resolveContent("본문 : 요한일서 1:1 옛본문")
        assertEquals("본문 : 요한일서 1:1 태초부터 있는", out)
    }

    @Test fun `roundtrip through VerseParser preserves structure`() {
        val input = "본문 : 로마서 13:11-14 old"
        val resolved = resolver().resolveContent(input)
        val dto = SermonDto(date = "2026-04-17", title = "t", content = resolved, dayOfWeek = "FRI")
        val sermon = VerseParser.verseDtoToVerse(dto)
        assertEquals("로마서 13:11-14", sermon.bookName)
        assertEquals(4, sermon.verses.size)
        assertEquals("11 또한 너희가", sermon.verses[0])
        assertEquals("14 오직 주", sermon.verses[3])
    }
}
```

Note: `alias is resolved` 테스트는 placeholder로 두고 실제 alias 경로 검증은 다른 테스트에서 커버(resolver 내부에서 Repository 호출 경로를 거치므로 `요한1서`/`요한일서` alias가 적용됨은 `BibleRepositoryTest`에서 이미 확인됨). 과잉 테스트를 피한다.

- [ ] **Step 2: 실패 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleReferenceResolverTest"
```
Expected: 컴파일 실패(BibleReferenceResolver 미존재).

- [ ] **Step 3: BibleReferenceResolver 구현**

Create `android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt`:

```kotlin
package app.mannadev.meditation.model

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleReferenceResolver @Inject constructor(
    private val repo: BibleRepository,
) {
    /** DTO 생성 직후 호출되는 SSoT 중앙 변환. content만 DB 본문으로 교체. */
    fun resolveDto(dto: SermonDto): SermonDto = dto.copy(content = resolveContent(dto.content))

    /** FCM/Firestore content 문자열을 DB 본문으로 재구성한 문자열로 변환. */
    fun resolveContent(fcmContent: String): String {
        val match = VerseParser.BOOK_NAME_REGEX.find(fcmContent)
            ?: throw VerseParseException.NoPrefixException()
        val prefix = match.groups[1]?.value.orEmpty()       // "본문 : " 혹은 빈 문자열
        val reference = match.groups["bookName"]?.value?.trim()
            ?: throw VerseParseException.NoBookNameException()

        // 각 파트에는 반드시 책명이 있어야 한다(현 VerseParser와 동일 수준).
        val parts = reference.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val allRows = ArrayList<BibleDb.VerseRow>()
        for (part in parts) {
            val m = PART_REGEX.matchEntire(part)
                ?: throw VerseParseException.InvalidVerseFormatException()
            val bookName = m.groups["book"]!!.value.trim()
            val chapter = m.groups["chapter"]!!.value.toInt()
            val start = m.groups["start"]!!.value.toInt()
            val end = m.groups["end"]?.value?.toInt() ?: start
            allRows.addAll(repo.getRange(bookName, chapter, start, end))
        }

        val body = if (allRows.size == 1) {
            allRows[0].text
        } else {
            allRows.joinToString(" ") { "${it.verse} ${it.text}" }
        }
        return "${prefix}${reference} $body"
    }

    companion object {
        // 책명(필수) + 장:시작[-끝]. 책명은 공백을 포함한 비숫자 토큰 연속.
        internal val PART_REGEX = Regex(
            """^(?<book>[^\d\s]+(?:\s+[^\d\s]+)*)\s+(?<chapter>\d+):(?<start>\d+)(?:-(?<end>\d+))?$"""
        )
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleReferenceResolverTest"
```
Expected: 모든 테스트 통과. Roundtrip 테스트가 VerseParser 역파싱 무손실을 보장.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt \
        android/app/src/test/java/app/mannadev/meditation/bible/BibleReferenceResolverTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): BibleReferenceResolver 추가

FCM/Firestore content의 참조를 파싱해 BibleRepository로 본문을 조회
한 뒤 VerseParser 역파싱 호환 포맷으로 재조립. resolveDto는 DTO
content만 DB 본문으로 교체.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: MyFirebaseMessagingService 통합

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt`

- [ ] **Step 1: DI 주입 및 resolve 호출 추가**

Edit `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt`:

1. `import app.mannadev.meditation.model.BibleReferenceResolver` 추가.
2. 클래스 내부, `asyncStorage` 필드 다음에 추가:
```kotlin
    @Inject
    lateinit var bibleReferenceResolver: BibleReferenceResolver
```
3. `consumeSermonEvent` 내부에서 `sermonDto` 파싱 직후, `saveDisplaySermonUseCase` 호출 블록 **전에** 다음을 삽입:
```kotlin
        val resolvedDto = runCatching { bibleReferenceResolver.resolveDto(sermonDto) }
            .onFailure { e ->
                Timber.e(e, "Failed to resolve bible content, skipping sermon update")
                CrashlyticsHelper.recordException(e, "BibleReferenceResolver failed: ${sermonDto.content}")
            }
            .getOrNull() ?: return
```

4. 이후 블록에서 `sermonDto`를 **모두** `resolvedDto`로 교체:
   - `saveDisplaySermonUseCase(sermonDto)` → `saveDisplaySermonUseCase(resolvedDto)`
   - AsyncStorage 쓰기에서 원본 `message.data` 맵이 아닌 resolved content를 반영한 맵으로 직렬화:
```kotlin
            withContext(Dispatchers.IO) {
                val dataWithResolvedContent = message.data.toMutableMap().apply {
                    put(KEY_CONTENT, resolvedDto.content)
                }
                asyncStorage.set(key = ASYNC_STORAGE_FCM_SERMON, value = Json.encodeToString(dataWithResolvedContent))
            }
```

(기타 `withContext(NonCancellable)`, `VerseWidgetLarge().updateAll(...)` 등 나머지 흐름은 변경하지 않는다.)

- [ ] **Step 2: 컴파일 확인**

Run:
```bash
cd android && ./gradlew :app:compileDebugKotlin
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 전체 단위 테스트 실행 (regression 확인)**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest
```
Expected: 전체 BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): FCM 수신 시 BibleReferenceResolver로 content 교체

resolve 실패 시 해당 메시지의 저장·위젯 갱신을 건너뛰어 틀린 본문이
노출되지 않도록 처리. AsyncStorage 저장분도 resolved content로 동기화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: SermonFirestoreDataSource 통합

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt`

- [ ] **Step 1: resolver 주입 및 DTO 변환 시점에 resolve**

Edit `android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt`:

1. `import app.mannadev.meditation.model.BibleReferenceResolver` 추가.
2. 생성자 시그니처 수정:
```kotlin
class SermonFirestoreDataSource @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val bibleReferenceResolver: BibleReferenceResolver,
)
```
3. `snapshotToSermonDto` 내부에서 DTO 생성 후 resolve 호출:
```kotlin
    private fun snapshotToSermonDto(snapshot: QuerySnapshot): SermonDto {
        if (snapshot.isEmpty) {
            throw SermonNotFoundException("Sermon document list was empty unexpectedly after non-empty snapshot.")
        }
        val document = snapshot.documents.first()
        val raw = document.data?.let { map ->
            SermonDto(
                date = map["date"] as String,
                title = map["title"] as String,
                content = map["content"] as String,
                dayOfWeek = map["day_of_week"] as String,
            )
        } ?: throw SermonNotFoundException("No sermons found in Firestore")
        return bibleReferenceResolver.resolveDto(raw)
    }
```

- [ ] **Step 2: 컴파일 확인**

Run:
```bash
cd android && ./gradlew :app:compileDebugKotlin
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 전체 단위 테스트 실행**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest
```
Expected: 기존 `SermonFirestoreDataSourceTest`의 TODO 테스트들은 여전히 no-op로 통과. 회귀 없음.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] feat(android): Firestore snapshot 수신 시 content를 DB 본문으로 교체

snapshotToSermonDto에서 DTO 생성 직후 BibleReferenceResolver.resolveDto
호출하여 SSoT 원칙 적용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 계기반 테스트 (실 DB 오픈·조회 검증)

**Files:**
- Create: `android/app/src/androidTest/java/app/mannadev/meditation/bible/BibleDbInstrumentedTest.kt`

**Rationale:** Unit test는 `android.database.sqlite` 클래스를 직접 사용할 수 없다. 실제 `assets/bible.db`가 올바르게 번들되고 복사/오픈/조회가 동작하는지 실기기 또는 에뮬레이터에서 확인.

- [ ] **Step 1: 계기반 테스트 작성**

Create `android/app/src/androidTest/java/app/mannadev/meditation/bible/BibleDbInstrumentedTest.kt`:

```kotlin
package app.mannadev.meditation.bible

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.mannadev.meditation.data.bible.BibleDbImpl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BibleDbInstrumentedTest {

    private val db = BibleDbImpl(ApplicationProvider.getApplicationContext())

    @Test fun `loads all 66 books`() {
        val map = db.loadBookIdByName()
        assertEquals(66, map.size)
        assertTrue(map.containsKey("창세기"))
        assertTrue(map.containsKey("요한계시록"))
        assertTrue(map.containsKey("요한1서"))
    }

    @Test fun `query romans 13 11 to 14 returns 4 verses`() {
        val books = db.loadBookIdByName()
        val rows = db.queryRange(bookId = books.getValue("로마서"), chapter = 13, startVerse = 11, endVerse = 14)
        assertEquals(4, rows.size)
        assertEquals(11, rows[0].verse)
        assertEquals(14, rows[3].verse)
        assertTrue(rows[0].text.isNotBlank())
    }
}
```

- [ ] **Step 2: 계기반 테스트 실행 (기기/에뮬레이터 필요)**

Run:
```bash
cd android && ./gradlew :app:connectedDebugAndroidTest --tests "app.mannadev.meditation.bible.BibleDbInstrumentedTest"
```
Expected: 2 tests, BUILD SUCCESSFUL.

**기기 없는 환경이라면:** 본 Task는 별도 QA 단계에서 수동 실행하는 것으로 표시하고 skip. 단위 테스트가 이미 Repository/Resolver까지 커버하므로 merge 차단 사유는 아님. `git status`로 파일이 있는지만 확인 후 commit.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/androidTest/java/app/mannadev/meditation/bible/BibleDbInstrumentedTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-74] test(android): bible.db 계기반 테스트 추가

실제 assets/bible.db 오픈 및 66권/범위 조회 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 최종 회귀 확인

- [ ] **Step 1: 전체 단위 테스트 실행**

Run:
```bash
cd android && ./gradlew :app:testDebugUnitTest
```
Expected: BUILD SUCCESSFUL, 전체 테스트 통과.

- [ ] **Step 2: 린트 (프로젝트 전체)**

Run (저장소 루트에서):
```bash
yarn lint
```
Expected: no lint errors.

- [ ] **Step 3: Android Debug APK 빌드**

Run:
```bash
cd android && ./gradlew :app:assembleDebug
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: (옵션) 실기기 수동 QA**
  - 앱 실행 후 테스트 FCM 메시지 전송.
  - AsyncStorage `fcm_sermon`의 content가 DB 본문으로 저장됐는지 RN 홈 화면에서 확인.
  - 위젯이 DB 본문을 표시하는지 홈 화면 위젯에서 확인.
  - 앱 로그에서 Crashlytics 경로로 예외가 올라가지 않는지 확인.

---

## Future Considerations (비범위)

- iOS 동등 구현(`BibleDbHelper.swift`) — 별도 이슈.
- 서버 FCM publisher가 본문 대신 참조만 보내는 페이로드 전환.
- Firestore `sermons` 문서 스키마 축소(content 필드 제거).
- 오탈자 허용 범위 확장을 위한 on-device LLM 기반 책명 매칭(Gemini Nano).
