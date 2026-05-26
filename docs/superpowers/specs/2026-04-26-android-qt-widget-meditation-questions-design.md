# Android QT 위젯 묵상 질문 표시 — Design

- Date: 2026-04-26
- Issue: [#84](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/84)
- Scope: **Android only.** iOS Swift 수정 없음.
- Related: [Sermon & QT Events v2 Phase 1](./2026-04-17-sermon-qt-events-v2-design.md) (해당 Phase에서 도입된 QT 위젯의 후속 작업)

## 1. Goal

1. Firestore `qt.meditation_questions` 와 FCM `qt_events.meditation_questions` 에 이미 존재하는 데이터를 Android QT 위젯(Small / Large)에 표시한다.
2. QT 위젯을 Sermon 모델 의존에서 분리하여 「말씀」「묵상 질문」 두 섹션 구조로 재구성한다.
3. RN 화면(`DailyMannaScreen`)에 이미 표시되는 묵상 질문이 위젯에서도 일관되게 보이도록 한다 (FCM 경로와 RN/Firestore 경로 모두).

## 2. Non-Goals

- iOS Widget Extension 변경 (`MeditationBlossomWidget.swift`, `Sermon.swift`)
- Sermon 위젯(`VerseWidgetLarge/Small`) 변경
- `BibleReferenceResolver` 출력 포맷 리팩토링 (reference / body 분리)
- EditScreen에서 QT 위젯 미리보기·커스터마이징 지원
- 묵상 질문 글머리 스타일을 RN 화면(`•/❶❷❸❹❺/숫자` 혼합)과 일치시키기
- Kotlin 단위 테스트 인프라 신규 도입

## 3. Key Decisions

| # | 주제 | 결정 | 근거 |
|---|------|------|------|
| 1 | `QtDto.meditationQuestions` 타입 | `List<String>` (이미 파싱된 리스트) | 위젯 LazyColumn에 직접 사용. 파싱 위치는 ingestion 경계 한 곳 |
| 2 | 빈 리스트 / 일요일 처리 | 「묵상 질문」 섹션 자체 미렌더 | 위젯 공간 절약. "없습니다" 메시지는 화면용 |
| 3 | 글머리 스타일 | 일관된 숫자(`1.`, `2.`, ...) | 좁은 위젯 폭에서 혼합 스타일은 노이즈 |
| 4 | Sermon 어댑터 의존 | 제거 | QT 위젯이 QT 도메인에 충실하게. `bookName`/`verses` 추출 로직 (`Sermon.fromDto`)과 결별 |
| 5 | reference/본문 분리 | `QtDto.content` 문자열을 위젯 측에서 split (현재 `Sermon.fromDto`와 동일 방식) | `BibleReferenceResolver` 리팩토링은 Sermon 위젯에도 영향. 별도 작업 |
| 6 | FCM 누락 필드 처리 | throw (다른 필수 필드와 동일) | 스키마가 strict (`docs/firestore-collections/qt.md`, `docs/fcm-events/qt-events.md`). 누락 = 계약 위반. 외부 `runCatching`이 Crashlytics 기록 |
| 7 | RN bridge 페이로드 | `useQtWidgetSync`에서만 `meditation_questions: string → array` 변환 | RN 화면용 `QT.meditation_questions: string` 타입 보존. 화면 코드 영향 0 |
| 8 | SharedPrefs 마이그레이션 | 없음 | kotlinx.serialization 기본값(`emptyList()`) + `ignoreUnknownKeys` 로 구버전 JSON 자동 호환 |

## 4. Data Model

### 4.1 `QtDto` 변경

```kotlin
@Serializable
data class QtDto(
    val date: String,
    val title: String,
    @SerialName("series_title")
    val seriesTitle: String,
    val content: String,
    @SerialName("day_of_week")
    val dayOfWeek: String,
    @SerialName("video_url")
    val videoUrl: String? = null,
    @SerialName("meditation_questions")
    val meditationQuestions: List<String> = emptyList(),  // 신규
)
```

기본값 `emptyList()`:
- 구버전 SharedPrefs JSON 역직렬화 시 안전
- 일요일 등 실제로 빈 리스트일 때 NPE 방지

### 4.2 신규 `QtWidgetUiModel`

위젯 컴포저블에 전달할 view-model. 두 위젯 파일에서 `Sermon`/`SermonDto` import 제거.

```kotlin
// android/.../ui/widget/qt/QtWidgetUiModel.kt
data class QtWidgetUiModel(
    val title: String,           // "시리즈 / 제목" 합쳐진 형태 (또는 시리즈 비어있으면 제목만)
    val dateLabel: String,       // "화 · 4월 26일" 등 (Large header용)
    val reference: String,       // "에베소서 5:15-16"
    val verses: List<String>,    // 본문 라인들
    val questions: List<String>, // 묵상 질문
    val videoUrl: String?,
) {
    companion object {
        val error: QtWidgetUiModel = QtWidgetUiModel(
            title = "QT를 불러오지 못했습니다",
            dateLabel = "",
            reference = "",
            verses = emptyList(),
            questions = emptyList(),
            videoUrl = null,
        )

        fun fromDto(dto: QtDto): QtWidgetUiModel {
            // 1) title 합치기
            val titleMerged = if (dto.seriesTitle.isNotBlank())
                "${dto.seriesTitle} / ${dto.title}" else dto.title

            // 2) reference / verses 추출:
            //    QtDto.content = "본문 : <참조> <verse 본문>" 포맷.
            //    기존 VerseParser.parse(SermonDto(...)) 재사용해서 (bookName, verses) 얻음.
            //    파싱 실패 시 reference="" + verses=listOf(content) 로 폴백 (위젯 비표시 회피).
            val parsed = runCatching {
                VerseParser.parse(SermonDto(
                    date = dto.date,
                    title = titleMerged,
                    content = dto.content,
                    dayOfWeek = dto.dayOfWeek,
                    videoUrl = dto.videoUrl,
                ))
            }.getOrNull()

            return QtWidgetUiModel(
                title = titleMerged,
                dateLabel = formatDateLabel(dto.date, dto.dayOfWeek),
                reference = parsed?.bookName.orEmpty(),
                verses = parsed?.verses ?: listOf(dto.content),
                questions = dto.meditationQuestions,
                videoUrl = dto.videoUrl,
            )
        }
    }
}
```

세부 결정:
- **`VerseParser` 재사용**: `Sermon` 데이터 클래스 자체는 위젯 composable에서 안 보이지만, parsing artifact로 내부에서 한 번 거침. 파서 분리 리팩토링은 scope 외.
- **약식 reference 미사용**: Small 위젯에서도 full reference (`"에베소서 5:15-16"`) 사용. 별도 약어 매핑 테이블 도입은 scope 외.
- **`dateLabel` 포맷**: `formatDateLabel(date: String /*YYYY-MM-DD*/, dayOfWeek: String /*MON~SUN*/) → "화 · 4월 26일"`. Java `SimpleDateFormat` + 한글 요일 매핑 표 (`MON→월, TUE→화...`). 헬퍼는 같은 파일 private function. Small 위젯은 dateLabel 미표시 (헤더 공간 부족).
- **파싱 실패 폴백**: `runCatching { VerseParser.parse(...) }.getOrNull()` → reference 빈 문자열 + verses는 raw content 한 줄로. 묵상 질문은 정상 표시. (현재 `Sermon.fromDto`는 `errorSermon`으로 떨어져 본문도 안 보이는데, 묵상 질문은 살아있을 수 있으니 더 관대한 폴백.)

## 5. Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ FCM 경로                                                       │
│                                                                │
│ FCM data["meditation_questions"]   "[\"Q1\",\"Q2\"]" (string) │
│   → MyFirebaseMessagingService.messageToQt()                  │
│       json.decodeFromString<List<String>>(it)                 │
│   → QtDto(..., meditationQuestions = parsed)                  │
│   → SaveDisplayQtUseCase                                      │
│   → QtPrefsDataSource (SharedPrefs, JSON encoded QtDto)       │
│   → updateAll() → 위젯 redraw                                 │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ RN/Firestore 경로                                             │
│                                                                │
│ Firestore qt collection                                        │
│   → src/services/qtService.fetchLatestQtFromServer()          │
│   → src/types/QT.firestoreDocToQt: array → JSON.stringify     │
│   → useQtData → useQtWidgetSync                               │
│       payload = { ...qt,                                       │
│         meditation_questions: JSON.parse(qt.meditation_questions ?? '[]') }
│       WidgetUpdateModule.onQtUpdated(JSON.stringify(payload)) │
│   → Kotlin: Json.decodeFromString<QtDto>(qtData)              │
│       (List<String>로 자동 역직렬화)                            │
│   → SaveDisplayQtUseCase                                      │
│   → 이후 동일                                                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 위젯 표시                                                      │
│                                                                │
│ Widget.provideGlance                                           │
│   → GetDisplayQtUseCase → QtDto                               │
│   → QtWidgetUiModel.fromDto(qt)                               │
│   → @Composable 두 섹션 렌더 (말씀 / 묵상 질문)                 │
└──────────────────────────────────────────────────────────────┘
```

## 6. UI Design

### 6.1 Large QT 위젯

```
┌─────────────────────────────────────┐
│ 화 · 4월 26일                        │  labelSmall
│ 하나님의 손길 / 빛의 자녀로 살라       │  titleMedium Bold, maxLines=2
├─────────────────────────────────────┤  divider Spacer
│ 말씀                                  │  labelMedium (section header)
│ 에베소서 5:15-16                      │  labelMedium
│ 15 그런즉 너희가 어떻게 행할지를…       │  bodyMedium
│ 16 세월을 아끼라 때가 악하니라          │  bodyMedium
│                                       │  Spacer 16dp
│ 묵상 질문                              │  labelMedium (section header)
│ 1. 오늘 말씀에서 가장 마음에…          │  bodyMedium
│ 2. …                                  │
│ 3. …                                  │
└─────────────────────────────────────┘
```

컴포저블 트리:
```
Column (full size, gradient bg, clickable)
├ Header Column (padding)
│  ├ Text(date+dayOfWeek)
│  └ Text(title, maxLines=2)
├ Spacer (divider)
├ LazyColumn (defaultWeight)
│  ├ item { SectionHeader("말씀") }
│  ├ item { Text(reference) }
│  ├ items(verses) { Text(...) }
│  ├ if (questions.isNotEmpty()) {
│  │    item { Spacer(16dp) }
│  │    item { SectionHeader("묵상 질문") }
│  │    itemsIndexed(questions) { i, q -> Text("${i+1}. $q") }
│  │  }
│  └ item { Spacer(bottom) }
```

### 6.2 Small QT 위젯

```
┌──────────────────────┐
│ 빛의 자녀로 살라        │  titleMedium, maxLines=2
├──────────────────────┤
│ 에베소서 5:15-16        │  labelSmall (full reference)
│ 세월을 아끼라…          │  bodyMedium, maxLines=3, ellipsis
│ ─────────              │  thin divider
│ 묵상 질문               │  labelSmall
│ 1. 오늘 말씀에서…       │  bodyMedium, maxLines=2, ellipsis
│ +2                     │  labelSmall (남은 개수)
└──────────────────────┘
```

컴포저블 트리:
```
Column (full size, white bg)
├ Text(title) (top padding)
├ Box (defaultWeight, gradient bg card with cornerRadius)
│  └ Column
│     ├ Text(reference)
│     ├ Text(verses joined " ", maxLines=3, ellipsis)
│     ├ if (questions.isNotEmpty()) {
│     │    Spacer(8dp); thin Divider
│     │    Text("묵상 질문")
│     │    Text("1. ${questions[0]}", maxLines=2, ellipsis)
│     │    if (questions.size > 1) Text("+${questions.size - 1}")
│     │  }
```

### 6.3 공통 규칙

- 클릭 액션: 기존 `widgetClickAction(qt?.videoUrl)` 유지 (위젯 전체 영역 → 영상 URL)
- 라벨: 이모지 미사용 (`📖✍` 제외). 텍스트 라벨 (`말씀`, `묵상 질문`) 만 사용
- 폰트/색상: 기존 `Typography` 테마 재사용
- 에러 폴백: `getDisplayQtUseCase()` null → 기존과 동일하게 `errorUiLayout` (R.layout.verse_widget_qt_*_error) 표시

## 7. Code Changes

### 7.1 Native (Android)

**`android/.../dto/QtDto.kt`**
- `meditationQuestions: List<String> = emptyList()` 필드 추가

**`android/.../service/MyFirebaseMessagingService.kt`**
- `KEY_MEDITATION_QUESTIONS = "meditation_questions"` 상수 추가
- `messageToQt()` 안에서 `data[KEY_MEDITATION_QUESTIONS] ?: throw IllegalArgumentException(...)` + `json.decodeFromString<List<String>>(...)` 추가
- `QtDto` 생성자에 `questions` 전달

**`android/.../ui/widget/qt/QtWidgetUiModel.kt`** (신규)
- 위 §4.2 정의

**`android/.../ui/widget/VerseWidgetLargeQt.kt`**
- `import SermonDto, Sermon` 제거
- `Sermon.fromDto(SermonDto(...))` → `QtWidgetUiModel.fromDto(qt)` 로 교체
- `Sermon.errorSermon` → `QtWidgetUiModel.error`
- `VerseWidgetLargeQtContent`를 §6.1 트리로 재구성 (SectionHeader composable 신규 추가)

**`android/.../ui/widget/VerseWidgetSmallQt.kt`**
- 위와 동일한 의존 제거 + §6.2 트리로 재구성

### 7.2 RN

**`src/hooks/useQtWidgetSync.ts`**
```ts
const payload = {
  ...qt,
  meditation_questions: JSON.parse(qt.meditation_questions ?? '[]'),
};
WidgetUpdateModule.onQtUpdated(JSON.stringify(payload));
```

**`__tests__/useQtWidgetSync.test.ts`** (신규 또는 보강)
- mock된 `WidgetUpdateModule.onQtUpdated`가 받은 인자에 `meditation_questions: ["Q1", "Q2"]` 형태의 array가 들어있는지 검증
- `qt.meditation_questions` 가 undefined일 때 `[]` 가 전달되는지 검증

### 7.3 변경 없는 영역

- `src/types/QT.ts` (RN 타입 그대로)
- `src/screens/DailyMannaScreen.tsx` (이미 동작 중)
- `SaveDisplayQtUseCase`, `GetDisplayQtUseCase`, `QtPrefsDataSource` (필드 추가만으로 자동 처리)
- iOS 코드 전체
- Sermon 위젯 / Sermon 모델
- `BibleReferenceResolver` / `Constants.kt`
- 문서 (`docs/firestore-collections/qt.md`, `docs/fcm-events/qt-events.md` 이미 최신)

## 8. Error Handling

| 시나리오 | 동작 |
|---------|------|
| FCM payload에 `meditation_questions` 키 없음 | `messageToQt()` throw → 외부 `consumeQtEvent`의 `runCatching`이 Crashlytics 기록 + QT 저장 스킵 |
| FCM `meditation_questions` JSON 파싱 실패 | 위와 동일 (스키마 위반) |
| RN bridge에서 `JSON.parse` 실패 | Promise reject → 기존 onQtUpdated 에러 경로로 전파 (Crashlytics) |
| Firestore에서 빈 배열 | `meditationQuestions = emptyList()` → 위젯에서 「묵상 질문」 섹션 미렌더 |
| 구버전 SharedPrefs JSON 읽기 (필드 없음) | kotlinx 기본값 `emptyList()` 적용 → 마이그레이션 코드 불필요 |
| `getDisplayQtUseCase()` null | 기존과 동일 — `errorUiLayout` 표시 |

## 9. Verification

### 9.1 자동 테스트

- Jest: `useQtWidgetSync` 의 페이로드 변환 단위 테스트

### 9.2 수동 검증 체크리스트

- [ ] FCM 시뮬레이터로 `meditation_questions` 포함 메시지 발송 → Large/Small 위젯에 질문 N개 표시
- [ ] 일요일 날짜 QT (questions=`[]`) → 「묵상 질문」 섹션이 두 위젯 모두에서 미표시
- [ ] RN 화면에서 QT 로드 (FCM 없이 Firestore만) → 위젯에 동일 질문 반영
- [ ] 앱 재실행 후 SharedPrefs 복원된 QT 위젯에 질문 유지
- [ ] 구버전 앱 빌드의 SharedPrefs JSON으로 신버전 실행 → 질문 섹션만 빈 채로 정상 동작 (크래시 없음)
- [ ] Small 위젯에서 질문이 1개일 때 "+N" 표기 미노출 확인
- [ ] 위젯 클릭 시 video_url 영상 열림 (기존 동작 회귀 없음)

## 10. Commit / PR Convention

- Branch: `feature/issue-84`
- Commits: `[ISSUE-84] feat: ...`, `[ISSUE-84] refactor: ...` 등
- PR Title: `[ISSUE-84] Android QT 위젯 묵상 질문 표시`
