# 성경 본문 DB 번들 (Android) — 설계 문서

- **이슈**: [#74 \[FE\] 성경 본문 DB 번들 추가 (Android / iOS)](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/74)
- **범위**: Android 전용. iOS·RN(JS) 레이어 무변경.
- **목적**: 성경 본문의 Single Source of Truth(SSoT)를 앱에 번들된 SQLite로 일원화. FCM 4KB 제약에 대비하여 네이티브에서 참조(책·장·절)만으로 본문을 재구성.
- **데이터 소스**: [MannaDevelopers/bible_databases — KorNRV (개역개정, Public Domain)](https://github.com/MannaDevelopers/bible_databases/tree/master/sources/ko/KorNRV). 빌드 머신 로컬 경로 기본값: `/Users/minchul/Workspace/bible_databases/sources/ko/KorNRV/KorNRV.json`.

---

## 1. 원칙

- **SSoT**: Android에서 `SermonDto`가 생성되는 모든 경로에서 DTO 생성 직후 본문을 DB 기준으로 덮어쓴다. 이후 코드는 이미 DB 본문을 가진 DTO를 소비한다.
- **RN 무변경**: AsyncStorage `fcm_sermon` 키에 저장되는 content도 DB 본문으로 교체된다. 홈 화면의 JS 파서는 그대로 동작한다.
- **위젯/VerseParser 무변경**: 저장 경계에서 본문이 치환되므로 하위 렌더링 경로는 손대지 않는다.
- **실패 처리**: fallback 없음. DB만 사용. 실패는 모두 Crashlytics 기록.

---

## 2. 아키텍처 & 파일 레이아웃

```
repo-root/
├── scripts/
│   └── build_bible_db.py           # JSON → SQLite 1회 변환 (로컬 실행)
├── docs/superpowers/specs/
│   └── 2026-04-17-bible-db-android-design.md   # 이 문서
└── android/app/src/main/
    ├── assets/
    │   └── bible.db                # 커밋됨 (읽기 전용, 약 4–6MB 예상)
    └── java/app/mannadev/meditation/
        ├── data/bible/
        │   ├── BibleDb.kt          # SQLite open/copy/query, @Singleton
        │   ├── BibleRepository.kt  # 이름 해석 + 범위 조회, @Singleton
        │   └── BibleBookAlias.kt   # 계층적 BookResolver
        └── model/
            └── BibleReferenceResolver.kt
                                    # 참조 문자열 → 재구성된 content, resolveDto(dto)
```

수정 지점(기존 파일): `MyFirebaseMessagingService.kt`, `SermonFirestoreDataSource.kt`. 그 외 기존 코드는 무변경.

---

## 3. SQLite 스키마 & 변환 스크립트

### 스키마

```sql
CREATE TABLE books (
  id      INTEGER PRIMARY KEY,   -- 1..66, 창세기=1 … 요한계시록=66
  name    TEXT NOT NULL UNIQUE   -- KorNRV 표준 표기 (예: "창세기", "요한1서")
);

CREATE TABLE verses (
  book_id   INTEGER NOT NULL,
  chapter   INTEGER NOT NULL,
  verse     INTEGER NOT NULL,
  text      TEXT    NOT NULL,
  PRIMARY KEY (book_id, chapter, verse),
  FOREIGN KEY (book_id) REFERENCES books(id)
) WITHOUT ROWID;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- meta 내용 (예시):
--   schema_version = '1'
--   source         = 'KorNRV'
--   source_sha     = '<bible_databases git sha>'
--   generated_at   = '<ISO8601>'
```

복합 PK + `WITHOUT ROWID`로 범위 조회가 인덱스만으로 완결. 추가 인덱스 불필요.

### 범위 조회 쿼리

```sql
SELECT verse, text
FROM verses
WHERE book_id = ? AND chapter = ? AND verse BETWEEN ? AND ?
ORDER BY verse;
```

### 변환 스크립트 (`scripts/build_bible_db.py`)

- 입력 기본: `/Users/minchul/Workspace/bible_databases/sources/ko/KorNRV/KorNRV.json` (`--input` 옵션으로 override 가능).
- 출력: `android/app/src/main/assets/bible.db`.
- 동작: JSON 로드 → 순서대로 66권에 id 부여 → verses insert → `meta` 기록 → `VACUUM` → `PRAGMA journal_mode = DELETE`.
- `README` 또는 스크립트 상단 docstring에 재생성 방법 기재. 결과 `.db`만 리포지토리에 커밋, JSON 원본은 커밋하지 않는다.

---

## 4. 컴포넌트 API

### `BibleDb` (data/bible/BibleDb.kt)

저장소 I/O만 담당. 첫 접근 시 `assets/bible.db` → `context.getDatabasePath("bible.db")` 복사. 이후 `SQLiteDatabase.openDatabase(..., OPEN_READONLY)`로 읽기 전용 오픈. asset 교체(버전 업데이트) 감지 시 재복사.

```kotlin
@Singleton
class BibleDb @Inject constructor(@ApplicationContext context: Context) {
    fun queryRange(bookId: Int, chapter: Int, startVerse: Int, endVerse: Int): List<VerseRow>
    data class VerseRow(val verse: Int, val text: String)
}
```

**DB 버전/교체 규약**
- `meta.source_sha`를 internal DB와 asset DB 간 비교해 교체 감지. 다르면 internal DB 삭제 후 재복사.
- 실패 시 기존 internal DB 유지. Crashlytics 기록.

### `BibleBookAlias` (data/bible/BibleBookAlias.kt) — 계층적 BookResolver

```
입력 ─┬─ Tier 1: ExactMap   ── hit ──► 표준명
      │  (양방향 alias map, O(1))
      │  miss
      ▼
     Tier 2: NormalizedMap  ── hit ──► 표준명
      │  (규칙 기반 전처리: 공백/점/괄호 제거, 숫자↔한글 변환,
      │   접미사 보완 → map 재조회)
      │  miss
      ▼
     Tier 3: FuzzyMatch     ── score ≥ threshold ──► 표준명
      │  (한글 자모 분해 후 Levenshtein 또는 Jaro-Winkler,
      │   66권 표준명을 candidate로 top-1)
      │  below threshold
      ▼
    BookAliasNotFoundException
```

**Tier 세부**
- **Tier 1 ExactMap**: 흔한 변형(`요한일서`, `1요한`, `요1` 등)을 직접 등록. ~100 엔트리 이하로 관리.
- **Tier 2 규칙 정규화**: 공백/구두점 제거, `일|이|삼|사 ↔ 1|2|3|4` 치환(책명 맥락), 누락된 접미사(`서/기`) 보완. 결과를 Tier 1 map에 재조회.
- **Tier 3 FuzzyMatch**: NFD + Hangul syllable decomposition으로 자모 시퀀스 변환. 66권 표준명에 대해 거리 계산(66회, 책명이 짧아 μs 수준). Threshold는 구현 중 튜닝. Levenshtein과 Jaro-Winkler 중 간결한 쪽으로 최종 선택.
- LLM(Gemini Nano 등) 기반 매칭은 이 문제에 오버킬로 판단하여 **이번 스코프에서 제외**.

```kotlin
object BibleBookAlias {
    fun resolve(input: String): String  // 실패 시 BookAliasNotFoundException
}
```

### `BibleRepository` (data/bible/BibleRepository.kt)

```kotlin
@Singleton
class BibleRepository @Inject constructor(private val db: BibleDb) {
    fun getRange(bookName: String, chapter: Int, startVerse: Int, endVerse: Int): List<BibleDb.VerseRow>
    // 내부: BibleBookAlias.resolve → bookId 캐시 조회 → db.queryRange
    // 실패 시: BookAliasNotFoundException | VerseRangeNotFoundException
}
```
- 책 이름 → id 매핑은 싱글톤 초기화 시 1회 로드해 메모리 캐싱.

### `BibleReferenceResolver` (model/BibleReferenceResolver.kt)

```kotlin
class BibleReferenceResolver @Inject constructor(
    private val repo: BibleRepository
) {
    /** "본문 : 로마서 13:11-14, 15:1-3" + (생략) →
     *  "본문 : 로마서 13:11-14, 15:1-3 11 또한… 12 밤이… … 1 … 2 … 3 …" */
    fun resolveContent(fcmContent: String): String

    /** SSoT 중앙 변환: DTO 생성 직후 호출 */
    fun resolveDto(dto: SermonDto): SermonDto = dto.copy(content = resolveContent(dto.content))
}
```

**재구성 규약**
- **Prefix 보존**: 원본에 `본문 :`(또는 변형)이 있었으면 동일 prefix 유지, 없었으면 생략. (`VerseParser.BOOK_NAME_REGEX`의 optional prefix 그룹 복제)
- **책명 상속**: `"로마서 13:11-14, 15:1-3"`처럼 2번째 이후 토큰에 책명이 생략되면 직전 책명을 사용. (현 `VerseParser`가 지원하는 수준 = 동일 책 내 다중 range.)
- **번호 포맷**: 총 구절 수가 2 이상이면 각 절 앞에 `{절번호} ` prefix. 1절이면 번호 없이 본문만. → `VerseParser`와 대칭되어 **재파싱 무손실**.
- **재사용**: `VerseParser`의 `BOOK_NAME_REGEX`와 `extractVerseNumbersFromReferenceString`을 공개 API로 활용하여 중복 제거.

---

## 5. 데이터 흐름 (SSoT)

```
[FCM data]                  [Firestore snapshot]
      │                              │
   messageToSermon                snapshotToSermonDto
      │                              │
      ▼                              ▼
  SermonDto(원본 content)        SermonDto(원본 content)
      │                              │
      └──── resolver.resolveDto() ──┘            ← 유일 경계
                   │
                   ▼
        SermonDto(content = DB 본문)
                   │
      ┌────────────┼────────────────┐
      ▼            ▼                ▼
   prefs 저장   AsyncStorage   Repository → 위젯
```

### 진입점 1: `MyFirebaseMessagingService.consumeSermonEvent`

```kotlin
val resolved = bibleReferenceResolver.resolveDto(sermonDto)
saveDisplaySermonUseCase(resolved)                                      // prefs
asyncStorage.set(
    key = ASYNC_STORAGE_FCM_SERMON,
    value = Json.encodeToString(message.data + ("content" to resolved.content))
)                                                                       // RN용
VerseWidgetLarge().updateAll(applicationContext)
VerseWidgetSmall().updateAll(applicationContext)
```

### 진입점 2: `SermonFirestoreDataSource.snapshotToSermonDto`

```kotlin
return resolver.resolveDto(SermonDto(date, title, content, dayOfWeek))
```

Firestore document는 변함 없이 전체 content를 포함한 채 반환되나, Android는 수신 즉시 DB 본문으로 덮어쓴다. Firestore 스키마를 참조 기반으로 축소하는 작업은 이번 스코프에 포함하지 않는다.

---

## 6. 에러 처리

- **fallback 없음**: 어떤 경로든 실패 시 `Crashlytics.recordException` 후 상위로 전파.
- 예외 타입:
  - `BookAliasNotFoundException(input: String)` — 3-Tier 모두 실패.
  - `VerseRangeNotFoundException(book: String, chapter: Int, range: IntRange)` — DB 조회 결과 비어있음.
  - 기존 `VerseParseException.*` — 참조 문자열 자체를 파싱 못 할 때.
  - `BibleDbInitException` — asset 복사/open 실패(발생 가능성 낮음, 테스트 단계에서 검출 기대).
- `consumeSermonEvent`는 기존 `runCatching {}` 블록 패턴 유지. resolve 실패 시 해당 메시지에 대한 저장·위젯 갱신을 **건너뛰어** 틀린 본문이 노출되지 않도록 한다.

---

## 7. 테스트

### 단위 테스트 (`android/app/src/test/`)
- `bible/BibleBookAliasTest.kt`
  - Tier 1 exact map: 알려진 변형 10~20개 → 표준명.
  - Tier 2 normalize: 공백/구두점/접미사/숫자-한글 치환 케이스.
  - Tier 3 fuzzy: known-good(오타 1–2자) / known-bad → threshold 검증.
- `bible/BibleReferenceResolverTest.kt`
  - 단일 range, 단일 절(번호 생략), 복합 range(책명 상속), alias 경유 케이스.
  - VerseParser 역파싱 무손실 검증(resolve 결과를 `VerseParser.parse`로 다시 돌려 원 구조 복원).
- `bible/BibleRepositoryTest.kt` — `:memory:` SQLite 또는 fake로 경계/범위 쿼리 검증.

### 계기반 테스트 (`android/app/src/androidTest/`, 신규)
- `BibleDbTest`: 실제 `assets/bible.db` 오픈 → 66권 로드, 샘플 절 조회 텍스트 일치, `meta.source_sha` 존재.

### 변환 스크립트 검증
- `scripts/build_bible_db.py` 실행 후 총 구절 수, 샘플 쿼리 결과를 sanity check(스크립트 말미 또는 README).

### 비수정 테스트
- `VerseParserTest` 등 기존 네이티브 테스트 무변경.
- RN Jest 테스트는 이번 PR 범위 밖.

---

## 8. 구현 순서 (PR 단위)

1. `scripts/build_bible_db.py` 추가 + `android/app/src/main/assets/bible.db` 커밋 + sanity check.
2. `BibleDb`, `BibleBookAlias`(Tier 1+2), `BibleRepository` + 단위 테스트.
3. `BibleBookAlias` Tier 3(FuzzyMatch) 추가 + threshold 튜닝.
4. `BibleReferenceResolver` + 단위 테스트.
5. `MyFirebaseMessagingService`에 resolver 통합.
6. `SermonFirestoreDataSource`에 resolver 통합.
7. 계기반 테스트 추가 및 실기기 QA.

---

## 9. 비범위 (Out of Scope)

- iOS(`BibleDbHelper.swift` 등) 구현 — 별도 이슈.
- RN(JS) 레이어 변경.
- Firestore 스키마 축소(현 단계에서는 문서 전체를 받고 무시).
- 서버 FCM publisher 변경.
- On-device LLM 기반 책명 매칭.
