# Android QT 위젯 묵상 질문 표시 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firestore `qt.meditation_questions` / FCM `qt_events.meditation_questions` 데이터를 Android QT 위젯(Small/Large)에 「말씀」「묵상 질문」 두 섹션 구조로 표시.

**Architecture:** `QtDto`에 `meditationQuestions: List<String>` 추가 → FCM 파서가 JSON string을 디코드해서 채움 → RN bridge(`useQtWidgetSync`)가 array로 변환해서 전달 → 위젯 composable이 신규 `QtWidgetUiModel`로 두 섹션 렌더. Sermon/SermonDto에 대한 위젯 의존은 `VerseParser` 호출 한 곳으로 격리.

**Tech Stack:** Kotlin, kotlinx.serialization, Glance AppWidget, React Native + TypeScript, Jest (`@testing-library/react-native`).

**Spec:** `docs/superpowers/specs/2026-04-26-android-qt-widget-meditation-questions-design.md`
**Issue:** [#84](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/84)
**Worktree:** `/Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84` on branch `feature/issue-84`

---

## File Structure

| 변경 종류 | 파일 | 책임 |
|----------|------|------|
| Modify | `src/hooks/useQtWidgetSync.ts` | RN→Native bridge 호출 직전 `meditation_questions` string→array 변환 |
| New    | `__tests__/useQtWidgetSync.test.ts` | 위 변환 동작 단위 테스트 |
| Modify | `android/app/src/main/java/app/mannadev/meditation/dto/QtDto.kt` | `meditationQuestions: List<String>` 필드 추가 |
| Modify | `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt` | `messageToQt()`에서 `meditation_questions` JSON 디코드 추가 |
| New    | `android/app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt` | 위젯 composable 전용 view-model + 날짜 포맷 헬퍼 |
| Modify | `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLargeQt.kt` | Sermon 의존 제거, `QtWidgetUiModel` 사용, 두 섹션 UI |
| Modify | `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmallQt.kt` | 위와 동일 (Small 변형) |

---

## Task 1 — RN bridge: `meditation_questions` string→array 변환

**Files:**
- Test: `__tests__/useQtWidgetSync.test.ts` (신규)
- Modify: `src/hooks/useQtWidgetSync.ts`

**Why:** Kotlin 측 `QtDto.meditationQuestions: List<String>`가 RN에서 넘어온 JSON 페이로드를 자동 역직렬화하려면, 페이로드 안의 `meditation_questions` 값이 JSON array (`["Q1","Q2"]`)여야 함. 현재 `qt.meditation_questions`는 RN 화면용으로 이미 `JSON.stringify`된 string이라 그대로 보내면 Kotlin에서 타입 mismatch.

- [ ] **Step 1: 테스트 파일 생성 (failing test)**

`__tests__/useQtWidgetSync.test.ts`:
```typescript
import { renderHook } from '@testing-library/react-native';
import { useQtWidgetSync } from '../src/hooks/useQtWidgetSync';
import WidgetUpdateModule from '../src/types/WidgetUpdateModule';
import type { QT } from '../src/types/QT';

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockOnQtUpdated = WidgetUpdateModule.onQtUpdated as jest.Mock;

const baseQt: QT = {
  id: 'qt-1',
  title: '빛의 자녀로 살라',
  series_title: '하나님의 손길',
  content: '본문 : 에베소서 5:15-16 15 그런즉... 16 세월을 아끼라...',
  date: '2026-04-26',
  day_of_week: 'SUN',
  created_at: { seconds: 0, nanoseconds: 0 },
  updated_at: { seconds: 0, nanoseconds: 0 },
};

describe('useQtWidgetSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('meditation_questions JSON 문자열을 array로 풀어서 onQtUpdated에 전달', () => {
    const qt: QT = {
      ...baseQt,
      meditation_questions: JSON.stringify(['Q1', 'Q2', 'Q3']),
    };

    renderHook(() => useQtWidgetSync(qt));

    expect(mockOnQtUpdated).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mockOnQtUpdated.mock.calls[0][0]);
    expect(payload.meditation_questions).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('meditation_questions가 undefined이면 빈 배열로 전달', () => {
    const qt: QT = { ...baseQt, meditation_questions: undefined };

    renderHook(() => useQtWidgetSync(qt));

    expect(mockOnQtUpdated).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mockOnQtUpdated.mock.calls[0][0]);
    expect(payload.meditation_questions).toEqual([]);
  });

  it('qt가 null이면 onQtUpdated 호출 안 함', () => {
    renderHook(() => useQtWidgetSync(null));
    expect(mockOnQtUpdated).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
npx jest __tests__/useQtWidgetSync.test.ts
```

Expected: 첫 번째 테스트 fail — payload.meditation_questions는 `JSON.stringify(['Q1','Q2','Q3'])` 문자열이 들어있을 것 (현재 hook이 그대로 stringify하므로).

- [ ] **Step 3: hook 수정**

`src/hooks/useQtWidgetSync.ts` 전체:
```typescript
import { useEffect } from 'react';
import { QT } from '../types/QT';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';

export function useQtWidgetSync(qt: QT | null): void {
  useEffect(() => {
    if (!qt) return;
    if (!WidgetUpdateModule?.onQtUpdated) {
      logger.error('WidgetUpdateModule.onQtUpdated is not available');
      return;
    }
    const payload = {
      ...qt,
      meditation_questions: JSON.parse(qt.meditation_questions ?? '[]'),
    };
    WidgetUpdateModule.onQtUpdated(JSON.stringify(payload)).catch((error) => {
      logger.error('Failed to update QT widget:', error);
    });
  }, [qt]);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest __tests__/useQtWidgetSync.test.ts
```

Expected: 3 tests passed.

- [ ] **Step 5: 전체 테스트 회귀 없음 확인**

```bash
yarn test
```

Expected: 101 passed (기존 98 + 신규 3), 1 skipped, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useQtWidgetSync.ts __tests__/useQtWidgetSync.test.ts
git commit -m "$(cat <<'EOF'
[ISSUE-84] feat: useQtWidgetSync에서 meditation_questions string→array 변환

RN 화면용 QT 타입은 meditation_questions를 JSON string으로 보관하지만,
Kotlin QtDto는 List<String>으로 자동 역직렬화하므로 bridge 호출 직전 array로 변환.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — `QtDto`에 `meditationQuestions` 필드 추가

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/dto/QtDto.kt`

**Why:** 모든 후속 Kotlin 변경의 기반. 기본값 `emptyList()` 덕분에 구버전 SharedPrefs JSON과 forward-compatible.

- [ ] **Step 1: 필드 추가**

`android/app/src/main/java/app/mannadev/meditation/dto/QtDto.kt` 전체:
```kotlin
package app.mannadev.meditation.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class QtDto(
    val date: String,                 // "YYYY-MM-DD"
    val title: String,
    @SerialName("series_title")
    val seriesTitle: String,
    val content: String,              // resolved (as per BibleReferenceResolver output)
    @SerialName("day_of_week")
    val dayOfWeek: String,
    @SerialName("video_url")
    val videoUrl: String? = null,
    @SerialName("meditation_questions")
    val meditationQuestions: List<String> = emptyList(),
)
```

- [ ] **Step 2: Kotlin 컴파일 확인**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android
./gradlew compileDebugKotlin
```

Expected: BUILD SUCCESSFUL. (기존 `QtDto(date=..., videoUrl=...)` 호출들은 새 필드가 default 값이라 깨지지 않음.)

- [ ] **Step 3: Commit**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
git add android/app/src/main/java/app/mannadev/meditation/dto/QtDto.kt
git commit -m "$(cat <<'EOF'
[ISSUE-84] feat: QtDto에 meditationQuestions 필드 추가

기본값 emptyList()로 구버전 SharedPrefs JSON 역직렬화 안전.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — FCM 파서: `meditation_questions` 추출

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt`

**Why:** FCM 페이로드에 이미 `meditation_questions`가 JSON string으로 들어오는데, `messageToQt()`가 추출하지 않고 있음.

- [ ] **Step 1: companion object에 상수 추가**

`MyFirebaseMessagingService.kt:46-53` (companion object) 안의 기존 상수들 바로 아래에 추가:

```kotlin
private const val KEY_MEDITATION_QUESTIONS = "meditation_questions"
```

(원본 상수 블록은 `KEY_DATE`부터 `KEY_TOPIC`까지 7개. 이 줄을 `KEY_TOPIC` 바로 위에 끼워 넣음.)

수정 후 companion object 일부:
```kotlin
private const val KEY_DATE = "date"
private const val KEY_TITLE = "title"
private const val KEY_SERIES_TITLE = "series_title"
private const val KEY_CONTENT = "content"
private const val KEY_BIBLE_REFERENCES = "bible_references"
private const val KEY_DAY_OF_WEEK = "day_of_week"
private const val KEY_VIDEO_URL = "video_url"
private const val KEY_MEDITATION_QUESTIONS = "meditation_questions"
private const val KEY_TOPIC = "topic"
```

- [ ] **Step 2: `messageToQt()`에 파싱 로직 + Json import 확인**

파일 상단에 `import kotlinx.serialization.json.Json` 이미 있음(라인 37 부근). 확인만.

`messageToQt()` 함수 전체를 다음으로 교체 (파일 라인 201~221):

```kotlin
private fun messageToQt(data: Map<String, String>): QtDto {
    val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in qt")
    val title = data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in qt")
    val seriesTitle = data[KEY_SERIES_TITLE] ?: ""
    val bibleRefsJson = data[KEY_BIBLE_REFERENCES]
        ?: throw IllegalArgumentException("Missing 'bible_references' in qt")
    val dayOfWeek = data[KEY_DAY_OF_WEEK]
        ?: throw IllegalArgumentException("Missing 'day_of_week' in qt")
    val questionsJson = data[KEY_MEDITATION_QUESTIONS]
        ?: throw IllegalArgumentException("Missing 'meditation_questions' in qt")

    val content = bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson)
    val videoUrl = data[KEY_VIDEO_URL]?.takeIf { it.isNotBlank() }
    val questions = Json.decodeFromString<List<String>>(questionsJson)

    return QtDto(
        date = date,
        title = title,
        seriesTitle = seriesTitle,
        content = content,
        dayOfWeek = dayOfWeek,
        videoUrl = videoUrl,
        meditationQuestions = questions,
    )
}
```

(`questions` 파싱 실패 시 throw → 외부 `consumeQtEvent`의 `runCatching`이 Crashlytics 기록 + QT 저장 스킵. 다른 필수 필드와 동일 처리.)

- [ ] **Step 3: Kotlin 컴파일 확인**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android
./gradlew compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
git add android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt
git commit -m "$(cat <<'EOF'
[ISSUE-84] feat: FCM messageToQt에서 meditation_questions JSON 디코드

페이로드에 이미 array JSON 문자열로 들어오는 필드를 List<String>으로 파싱해
QtDto.meditationQuestions에 채움. 누락/파싱 실패는 throw → 외부 runCatching
처리에서 Crashlytics 기록.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `QtWidgetUiModel` 신규 파일

**Files:**
- New: `android/app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt`

**Why:** 위젯 composable을 `Sermon` 모델 의존에서 분리. `VerseParser.parse()`는 reference/verses 추출용으로만 사용 (parsing artifact). 날짜 라벨 포맷도 같은 파일에 격리.

- [ ] **Step 1: 디렉토리 생성 + 파일 작성**

```bash
mkdir -p /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android/app/src/main/java/app/mannadev/meditation/ui/widget/qt
```

`android/app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt`:
```kotlin
package app.mannadev.meditation.ui.widget.qt

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.VerseParser
import java.text.SimpleDateFormat
import java.util.Locale

data class QtWidgetUiModel(
    val title: String,
    val dateLabel: String,        // "화 · 4월 26일"
    val reference: String,        // "에베소서 5:15-16"
    val verses: List<String>,
    val questions: List<String>,
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
            val titleMerged = if (dto.seriesTitle.isNotBlank())
                "${dto.seriesTitle} / ${dto.title}" else dto.title

            val parsed = runCatching {
                VerseParser.parse(
                    SermonDto(
                        date = dto.date,
                        title = titleMerged,
                        content = dto.content,
                        dayOfWeek = dto.dayOfWeek,
                        videoUrl = dto.videoUrl,
                    )
                )
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

private val DATE_INPUT_FORMAT = SimpleDateFormat("yyyy-MM-dd", Locale.KOREA)
private val DATE_OUTPUT_FORMAT = SimpleDateFormat("M월 d일", Locale.KOREA)

private val DAY_OF_WEEK_KO = mapOf(
    "MON" to "월", "TUE" to "화", "WED" to "수", "THU" to "목",
    "FRI" to "금", "SAT" to "토", "SUN" to "일",
)

internal fun formatDateLabel(date: String, dayOfWeek: String): String {
    val day = DAY_OF_WEEK_KO[dayOfWeek.uppercase(Locale.ROOT)] ?: return ""
    val parsedDate = runCatching { DATE_INPUT_FORMAT.parse(date) }.getOrNull() ?: return day
    return "$day · ${DATE_OUTPUT_FORMAT.format(parsedDate)}"
}
```

- [ ] **Step 2: Kotlin 컴파일 확인**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android
./gradlew compileDebugKotlin
```

Expected: BUILD SUCCESSFUL. 파일은 아직 어디서도 import 안 되지만 자체로 컴파일 가능해야 함.

- [ ] **Step 3: Commit**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt
git commit -m "$(cat <<'EOF'
[ISSUE-84] feat: QT 위젯용 view-model QtWidgetUiModel 신규

VerseParser로 reference/verses 추출, 날짜 라벨 한글 포맷 헬퍼 포함.
파싱 실패 시 reference 빈 문자열 + verses는 raw content로 폴백 (질문은 살림).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Large QT 위젯 UI 재구성

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLargeQt.kt`

**Why:** Sermon 모델 의존 제거하고 「말씀」「묵상 질문」 두 섹션 UI로 재구성. spec §6.1.

- [ ] **Step 1: 파일 전체 교체**

`android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLargeQt.kt` 전체:
```kotlin
package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.ui.widget.theme.Typography
import timber.log.Timber

class VerseWidgetLargeQt : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_large_error,
) {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val dependencies = getWidgetDependencies(context)
        val getDisplayQtUseCase = dependencies.getDisplayQtUseCase()
        val qt = getDisplayQtUseCase() ?: run {
            Timber.w("VerseWidgetLargeQt: No QT data, using error fallback")
            CrashlyticsHelper.recordException(
                IllegalStateException("VerseWidgetLargeQt: getDisplayQtUseCase returned null"),
                "QT widget displayed error fallback due to missing data"
            )
            null
        }
        val uiModel = qt?.let(QtWidgetUiModel::fromDto) ?: QtWidgetUiModel.error
        val clickAction = widgetClickAction(uiModel.videoUrl)

        provideContent { VerseWidgetLargeQtContent(uiModel, clickAction) }
    }
}

private object VerseLargeQtDimens {
    val appBarVerticalPadding = 24.dp
    val horizontalPadding = 24.dp
    val bottomPadding = 24.dp
    val sectionGap = 16.dp
    val sectionInnerGap = 8.dp
    val dateLabelBottomGap = 4.dp
}

@Composable
private fun VerseWidgetLargeQtContent(ui: QtWidgetUiModel, clickAction: Action) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(clickAction)
            .appWidgetBackground()
            .xmlGradientBackground(),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Column(
            modifier = GlanceModifier.padding(
                horizontal = VerseLargeQtDimens.horizontalPadding,
                vertical = VerseLargeQtDimens.appBarVerticalPadding,
            ),
        ) {
            if (ui.dateLabel.isNotBlank()) {
                Text(
                    text = ui.dateLabel,
                    style = Typography.labelSmall,
                )
                Spacer(GlanceModifier.height(VerseLargeQtDimens.dateLabelBottomGap))
            }
            Text(
                text = ui.title,
                style = Typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 2,
            )
        }
        LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
            item {
                Text(
                    modifier = GlanceModifier.padding(horizontal = VerseLargeQtDimens.horizontalPadding),
                    text = "말씀",
                    style = Typography.labelMedium,
                )
            }
            if (ui.reference.isNotBlank()) {
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionInnerGap)) }
                item {
                    Text(
                        modifier = GlanceModifier.padding(horizontal = VerseLargeQtDimens.horizontalPadding),
                        text = ui.reference,
                        style = Typography.labelMedium,
                    )
                }
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionInnerGap)) }
            items(ui.verses) { verse ->
                Text(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                        .clickable(clickAction),
                    text = verse,
                    style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
            }
            if (ui.questions.isNotEmpty()) {
                val numberedQuestions = ui.questions.mapIndexed { index, q -> "${index + 1}. $q" }
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionGap)) }
                item {
                    Text(
                        modifier = GlanceModifier.padding(horizontal = VerseLargeQtDimens.horizontalPadding),
                        text = "묵상 질문",
                        style = Typography.labelMedium,
                    )
                }
                item { Spacer(GlanceModifier.height(VerseLargeQtDimens.sectionInnerGap)) }
                items(numberedQuestions) { numbered ->
                    Text(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                            .clickable(clickAction),
                        text = numbered,
                        style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                    )
                }
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.bottomPadding)) }
        }
    }
}
```

- [ ] **Step 2: Kotlin 컴파일 확인**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android
./gradlew compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLargeQt.kt
git commit -m "$(cat <<'EOF'
[ISSUE-84] feat: Large QT 위젯에 묵상 질문 섹션 추가

Sermon/SermonDto 의존 제거. QtWidgetUiModel 사용해서 「말씀」「묵상 질문」
두 섹션 LazyColumn 렌더. 질문이 빈 리스트면 섹션 미표시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Small QT 위젯 UI 재구성

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmallQt.kt`

**Why:** Sermon 의존 제거 + spec §6.2 구조 (full reference + 본문 ellipsis + 첫 질문 + "+N" 잔여).

- [ ] **Step 1: 파일 전체 교체**

`android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmallQt.kt` 전체:
```kotlin
package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.ui.widget.theme.Typography
import timber.log.Timber

class VerseWidgetSmallQt : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_qt_small_error,
) {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val dependencies = getWidgetDependencies(context)
        val getDisplayQtUseCase = dependencies.getDisplayQtUseCase()
        val qt = getDisplayQtUseCase() ?: run {
            Timber.w("VerseWidgetSmallQt: No QT data, using error fallback")
            CrashlyticsHelper.recordException(
                IllegalStateException("VerseWidgetSmallQt: getDisplayQtUseCase returned null"),
                "QT widget displayed error fallback due to missing data"
            )
            null
        }
        val uiModel = qt?.let(QtWidgetUiModel::fromDto) ?: QtWidgetUiModel.error
        val clickAction = widgetClickAction(uiModel.videoUrl)

        provideContent { VerseWidgetSmallQtContent(uiModel, clickAction) }
    }
}

private object VerseSmallQtDimens {
    val appBarVerticalPadding = 20.dp
    val horizontalPadding = 24.dp
    val contentBackgroundRadius = 16.dp
    val contentPadding = 12.dp
    val widgetPadding = 12.dp
    val sectionGap = 8.dp
    val dividerHeight = 1.dp
}

@Composable
private fun VerseWidgetSmallQtContent(ui: QtWidgetUiModel, clickAction: Action) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(clickAction)
            .appWidgetBackground()
            .background(Color.White),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        Text(
            modifier = GlanceModifier.padding(
                horizontal = VerseSmallQtDimens.horizontalPadding,
                vertical = VerseSmallQtDimens.appBarVerticalPadding,
            ),
            text = ui.title,
            style = Typography.titleMedium,
            maxLines = 2,
        )
        Box(
            GlanceModifier
                .padding(horizontal = VerseSmallQtDimens.widgetPadding)
                .padding(bottom = VerseSmallQtDimens.widgetPadding)
                .defaultWeight()
                .fillMaxWidth()
        ) {
            Column(
                GlanceModifier
                    .cornerRadius(VerseSmallQtDimens.contentBackgroundRadius)
                    .xmlGradientBackground()
                    .fillMaxSize()
                    .padding(VerseSmallQtDimens.contentPadding)
            ) {
                if (ui.reference.isNotBlank()) {
                    Text(
                        text = ui.reference,
                        style = Typography.labelSmall,
                    )
                    Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap))
                }
                Text(
                    text = ui.verses.joinToString(" "),
                    style = Typography.bodyMedium,
                    maxLines = 3,
                )
                if (ui.questions.isNotEmpty()) {
                    Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap))
                    Box(
                        GlanceModifier
                            .fillMaxWidth()
                            .height(VerseSmallQtDimens.dividerHeight)
                            .background(ColorProvider(Color(0x33000000)))
                    ) {}
                    Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap))
                    Text(
                        text = "묵상 질문",
                        style = Typography.labelSmall,
                    )
                    Spacer(GlanceModifier.height(VerseSmallQtDimens.sectionGap))
                    Text(
                        text = "1. ${ui.questions[0]}",
                        style = Typography.bodyMedium,
                        maxLines = 2,
                    )
                    if (ui.questions.size > 1) {
                        Text(
                            text = "+${ui.questions.size - 1}",
                            style = Typography.labelSmall,
                        )
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 2: Kotlin 컴파일 확인**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android
./gradlew compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

만약 `androidx.glance.unit.ColorProvider` import가 잘못되었다면 (Glance 버전에 따라 위치 다를 수 있음), 동일 패키지의 다른 위젯 파일을 grep해서 패턴 맞춤:
```bash
/usr/bin/grep -rn "ColorProvider" /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android/app/src/main/java/app/mannadev/meditation/ui/widget/ --include="*.kt"
```
다른 import 경로를 발견하면 그것으로 교체.

- [ ] **Step 3: Commit**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmallQt.kt
git commit -m "$(cat <<'EOF'
[ISSUE-84] feat: Small QT 위젯에 묵상 질문 섹션 추가

Sermon/SermonDto 의존 제거. 본문은 verses 합쳐서 maxLines=3 ellipsis,
첫 질문 + "+N" 잔여 표기. 질문 빈 리스트면 섹션 미표시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — 통합 검증

**Files:** (none modified)

**Why:** 모든 변경 후 회귀 없음 확인 + 수동 검증 체크리스트 실행.

- [ ] **Step 1: 전체 RN 테스트 실행**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84
yarn test
```

Expected: 101 passed, 1 skipped, 0 failed.

- [ ] **Step 2: ESLint**

```bash
yarn lint
```

Expected: 0 errors. (warning은 기존 수준 유지)

- [ ] **Step 3: Android 디버그 APK 빌드 (compile + resource pack 검증)**

```bash
cd /Users/minchul/Projects/meditation_blossom_frontend/.worktrees/issue-84/android
./gradlew assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 수동 검증 체크리스트 (사용자가 실행)**

다음 항목들을 사용자에게 전달하여 실기기 또는 에뮬레이터에서 확인 요청:

```
[ ] FCM 시뮬레이터로 meditation_questions 포함 메시지 발송
    → Large QT 위젯에 「묵상 질문」 섹션 표시 + 질문 N개 모두 보임
    → Small QT 위젯에 첫 질문 + "+N" 보임

[ ] 일요일 날짜의 QT (questions=[])
    → Large/Small 모두 「묵상 질문」 섹션 자체 미표시 (빈 공간만)

[ ] 앱 화면(DailyMannaScreen)에서 QT 로드 (FCM 이벤트 없이 Firestore만)
    → 위젯에 동일한 묵상 질문 반영됨

[ ] 앱 강제 종료 후 재실행
    → SharedPrefs에서 복원된 QT 위젯에 질문 유지

[ ] 구버전 빌드의 SharedPrefs JSON으로 신버전 실행 (기존 사용자 시뮬레이션)
    → 위젯 크래시 없음, 「묵상 질문」 섹션만 빈 채로 정상 표시

[ ] Small 위젯에서 질문 1개일 때
    → "+0" 또는 "+N" 미표시 확인

[ ] 위젯 클릭
    → video_url 영상 정상 열림 (회귀 없음)
```

- [ ] **Step 5: 사용자 검증 완료 후 PR 생성 단계로 (별도)**

이 시점에 모든 task 완료. 다음 단계는 `superpowers:finishing-a-development-branch` 스킬로 PR 생성.
