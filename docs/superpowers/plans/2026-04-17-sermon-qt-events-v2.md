# Sermon & QT Events v2 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate sermon FCM events to v2 (`sermon_events_v2`), introduce parallel `qt_events` pipeline with Android widget + DailyMannaScreen integration. Android-only (iOS explicitly out of scope).

**Architecture:** Two parallel pipelines (Sermon/QT). Android `BibleReferenceResolver` re-queries local `BibleDb` from payload's `bible_references` (ignoring payload `verses`), emitting same single-string `content` format as v1. RN calls Android `WidgetUpdateModule` bridge to resolve Firestore-sourced `bible_references`. On iOS, `content` returns empty string — accepted.

**Tech Stack:** Kotlin / Glance AppWidget / Hilt / kotlinx.serialization on Android. React Native 0.78 / TypeScript / Jest on JS. FCM data messages.

**Spec reference:** `docs/superpowers/specs/2026-04-17-sermon-qt-events-v2-design.md`

---

## Precondition

Before starting Task 1, ensure the working tree has the existing WIP changes from the branch (`Constants.kt`, `MainApplication.kt`, `BibleReferenceResolver.kt`). Task 1 commits these as a baseline.

Verify:
```bash
git -C /Users/minchul/Projects/meditation_blossom_frontend/.claude/worktrees/issue-54 status
```

Expected: three modified files listed — `android/app/src/main/java/app/mannadev/meditation/Constants.kt`, `MainApplication.kt`, `model/BibleReferenceResolver.kt`.

---

## Task 1: Commit WIP baseline (Constants + MainApplication + Resolver stub)

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/Constants.kt` (already dirty)
- Modify: `android/app/src/main/java/app/mannadev/meditation/MainApplication.kt` (already dirty)
- Modify: `android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt` (already dirty — `resolveBibleReferencesJson` stub)

- [ ] **Step 1: Verify dirty state matches precondition**

Run:
```bash
git status
```

Expected output contains the three modified files above. If Constants.kt is missing any of `SERMON_SUBJECT`, `SERMON_SUBJECT_V2`, `QT_SUBJECT`, `ASYNC_STORAGE_FCM_QT`, stop and reconcile before committing.

- [ ] **Step 2: Stage and commit baseline**

```bash
git add android/app/src/main/java/app/mannadev/meditation/Constants.kt \
         android/app/src/main/java/app/mannadev/meditation/MainApplication.kt \
         android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt
git commit -m "[ISSUE-54] feat(android): baseline for v2 migration (topics + resolver stub)

- Constants: add SERMON_SUBJECT_V2, QT_SUBJECT, ASYNC_STORAGE_FCM_QT
- MainApplication: unsubscribe v1 sermon_events, subscribe sermon_events_v2 + qt_events (debug _test variants)
- BibleReferenceResolver: stub resolveBibleReferencesJson for next task"
```

---

## Task 2: Implement `BibleReferenceResolver.resolveBibleReferencesJson` (TDD)

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt`
- Modify: `android/app/src/test/java/app/mannadev/meditation/bible/BibleReferenceResolverTest.kt`

**Goal:** Parse v2 JSON array of bible references, query BibleDb per reference, emit single-line `"본문 : {refs} {body}"` string matching v1 `resolveContent` format. `verses` field in payload is ignored.

- [ ] **Step 1: Add failing tests**

Append to `android/app/src/test/java/app/mannadev/meditation/bible/BibleReferenceResolverTest.kt` (inside the class, before closing brace):

```kotlin
    @Test fun `json single range with prefix uses DB not payload verses`() {
        val json = """[{"book":"로마서","chapter":13,"verse_start":11,"verse_end":14,"verses":[{"verse_number":11,"content":"IGNORED"}]}]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals(
            "본문 : 로마서 13:11-14 11 또한 너희가 12 밤이 깊고 13 낮에와 같이 14 오직 주",
            out,
        )
    }

    @Test fun `json single verse drops number prefix`() {
        val json = """[{"book":"요한복음","chapter":3,"verse_start":16,"verse_end":16}]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals("본문 : 요한복음 3:16 하나님이 세상을", out)
    }

    @Test fun `json multi range across books joins with comma`() {
        val json = """[
          {"book":"창세기","chapter":22,"verse_start":2,"verse_end":2},
          {"book":"신명기","chapter":34,"verse_start":4,"verse_end":4},
          {"book":"요한복음","chapter":3,"verse_start":30,"verse_end":30}
        ]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals(
            "본문 : 창세기 22:2, 신명기 34:4, 요한복음 3:30 2 여호와께서 이르시되 4 이는 내가 아브라함과 30 그는 흥하여야",
            out,
        )
    }

    @Test fun `json alias is resolved via repository`() {
        val json = """[{"book":"요한일서","chapter":1,"verse_start":1,"verse_end":1}]"""
        val out = resolver().resolveBibleReferencesJson(json)
        assertEquals("본문 : 요한일서 1:1 태초부터 있는", out)
    }

    @Test(expected = Exception::class)
    fun `json empty array throws`() {
        resolver().resolveBibleReferencesJson("[]")
    }

    @Test(expected = Exception::class)
    fun `json malformed throws`() {
        resolver().resolveBibleReferencesJson("not-json")
    }
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleReferenceResolverTest"
```

Expected: the 6 new tests FAIL (current stub returns `""`).

- [ ] **Step 3: Implement `resolveBibleReferencesJson`**

Replace the stub in `android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt`. Final file:

```kotlin
package app.mannadev.meditation.model

import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleRepository
import app.mannadev.meditation.dto.SermonDto
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleReferenceResolver @Inject constructor(
    private val repo: BibleRepository,
) {
    fun resolveDto(dto: SermonDto): SermonDto = dto.copy(content = resolveContent(dto.content))

    fun resolveContent(fcmContent: String): String {
        val match = VerseParser.BOOK_NAME_REGEX.find(fcmContent)
            ?: throw VerseParseException.NoPrefixException()
        val prefix = match.groups[1]?.value.orEmpty()
        val reference = match.groups["bookName"]?.value?.trim()
            ?: throw VerseParseException.NoBookNameException()

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

    /** v2 `bible_references` JSON 배열 문자열을 받아 "본문 : {refs} {body}" 형식으로 반환. */
    fun resolveBibleReferencesJson(jsonStr: String): String {
        val refs = json.decodeFromString<List<BibleReferenceJson>>(jsonStr)
        if (refs.isEmpty()) throw VerseParseException.NoBookNameException()

        val allRows = ArrayList<BibleDb.VerseRow>()
        val refStrings = refs.map { ref ->
            allRows.addAll(repo.getRange(ref.book, ref.chapter, ref.verse_start, ref.verse_end))
            val range = if (ref.verse_start == ref.verse_end) {
                "${ref.chapter}:${ref.verse_start}"
            } else {
                "${ref.chapter}:${ref.verse_start}-${ref.verse_end}"
            }
            "${ref.book} $range"
        }
        val reference = refStrings.joinToString(", ")
        val body = if (allRows.size == 1) {
            allRows[0].text
        } else {
            allRows.joinToString(" ") { "${it.verse} ${it.text}" }
        }
        return "본문 : $reference $body"
    }

    @Serializable
    private data class BibleReferenceJson(
        val book: String,
        val chapter: Int,
        val verse_start: Int,
        val verse_end: Int,
    )

    companion object {
        internal val PART_REGEX = Regex(
            """^(?<book>[^\d\s]+(?:\s+[^\d\s]+)*)\s+(?<chapter>\d+):(?<start>\d+)(?:-(?<end>\d+))?$"""
        )
        private val json = Json { ignoreUnknownKeys = true }
    }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleReferenceResolverTest"
```

Expected: all tests PASS (existing + 6 new).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/model/BibleReferenceResolver.kt \
         android/app/src/test/java/app/mannadev/meditation/bible/BibleReferenceResolverTest.kt
git commit -m "[ISSUE-54] feat(android): resolve bible_references JSON via BibleDb

Parses v2 bible_references array, queries local BibleDb ignoring payload
'verses' field, emits single-line '본문 : {refs} {body}' format identical to v1."
```

---

## Task 3: Add QT broadcast constants

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/Constants.kt`

- [ ] **Step 1: Add QT broadcast constants**

Current file has sermon broadcast constants. Add QT analogues. Final file:

```kotlin
package app.mannadev.meditation

object Constants {
    const val SERMON_SUBJECT = "sermon_events" // For unsubscription
    const val SERMON_SUBJECT_V2 = "sermon_events_v2"
    const val QT_SUBJECT = "qt_events"

    const val ACTION_SERMON_UPDATE_EVENT = "app.mannadev.meditation.SERMON_UPDATE_EVENT"
    const val MESSAGE_SERMON_UPDATE_EVENT = "ON_SERMON_UPDATE"

    const val ACTION_QT_UPDATE_EVENT = "app.mannadev.meditation.QT_UPDATE_EVENT"
    const val MESSAGE_QT_UPDATE_EVENT = "ON_QT_UPDATE"

    const val ASYNC_STORAGE_FCM_SERMON = "fcm_sermon"
    const val ASYNC_STORAGE_FCM_QT = "fcm_qt"
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/Constants.kt
git commit -m "[ISSUE-54] feat(android): add QT broadcast/event constants"
```

---

## Task 4: Create `QtDto`

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/dto/QtDto.kt`

- [ ] **Step 1: Create `QtDto`**

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
)
```

- [ ] **Step 2: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/dto/QtDto.kt
git commit -m "[ISSUE-54] feat(android): add QtDto for QT data persistence"
```

---

## Task 5: Create `QtPrefsDataSource`

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/data/QtPrefsDataSource.kt`

- [ ] **Step 1: Create `QtPrefsDataSource`** (mirrors `SermonPrefsDataSource` with different keys)

```kotlin
package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit
import app.mannadev.meditation.dto.QtDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QtPrefsDataSource @Inject constructor(
    @ApplicationContext context: Context
) {
    companion object {
        private const val PREFS_NAME = "qt_prefs"
        private const val KEY_DISPLAY_QT_JSON = "display_qt_json"

        private val json = Json { ignoreUnknownKeys = true }
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    suspend fun getDisplayQt(): QtDto? = withContext(Dispatchers.IO) {
        val jsonString = prefs.getString(KEY_DISPLAY_QT_JSON, null)
        if (jsonString.isNullOrBlank()) return@withContext null
        try {
            json.decodeFromString<QtDto>(jsonString)
        } catch (e: Exception) {
            throw RuntimeException("Error decoding QT JSON: $jsonString", e)
        }
    }

    suspend fun saveDisplayQt(qt: QtDto) = withContext(Dispatchers.IO) {
        prefs.edit {
            putString(KEY_DISPLAY_QT_JSON, json.encodeToString(qt))
        }
    }

    suspend fun clearDisplayQt() = withContext(Dispatchers.IO) {
        prefs.edit { remove(KEY_DISPLAY_QT_JSON) }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/QtPrefsDataSource.kt
git commit -m "[ISSUE-54] feat(android): add QtPrefsDataSource for QT persistence"
```

---

## Task 6: Create QT usecases (Save / Get / Clear)

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/SaveDisplayQtUseCase.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplayQtUseCase.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/ClearQtPreferenceUseCase.kt`

- [ ] **Step 1: Create `SaveDisplayQtUseCase`**

```kotlin
package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.QtPrefsDataSource
import app.mannadev.meditation.dto.QtDto
import javax.inject.Inject

class SaveDisplayQtUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource
) {
    suspend operator fun invoke(qt: QtDto) {
        prefsDataSource.saveDisplayQt(qt)
    }
}
```

- [ ] **Step 2: Create `GetDisplayQtUseCase`**

```kotlin
package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.QtPrefsDataSource
import app.mannadev.meditation.dto.QtDto
import javax.inject.Inject

class GetDisplayQtUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource
) {
    suspend operator fun invoke(): QtDto? {
        return prefsDataSource.getDisplayQt()
    }
}
```

- [ ] **Step 3: Create `ClearQtPreferenceUseCase`**

```kotlin
package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.QtPrefsDataSource
import javax.inject.Inject

class ClearQtPreferenceUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource
) {
    suspend operator fun invoke() {
        prefsDataSource.clearDisplayQt()
    }
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/domain/usecase/SaveDisplayQtUseCase.kt \
         android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplayQtUseCase.kt \
         android/app/src/main/java/app/mannadev/meditation/domain/usecase/ClearQtPreferenceUseCase.kt
git commit -m "[ISSUE-54] feat(android): add QT use cases (save/get/clear)"
```

---

## Task 7: Extend Hilt entry points for QT

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/RNModuleDependencies.kt`

- [ ] **Step 1: Extend `WidgetDependencies`** — add QT getter

Final file:
```kotlin
package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.domain.usecase.GetDisplayQtUseCase
import app.mannadev.meditation.domain.usecase.GetDisplaySermonUseCase
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetDependencies {
    fun getDisplaySermonUseCase(): GetDisplaySermonUseCase
    fun getDisplayQtUseCase(): GetDisplayQtUseCase
}

fun getWidgetDependencies(context: Context): WidgetDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        WidgetDependencies::class.java
    )
}
```

- [ ] **Step 2: Extend `RNModuleDependencies`** — add QT getters

Final file:
```kotlin
package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.domain.usecase.ClearQtPreferenceUseCase
import app.mannadev.meditation.domain.usecase.ClearWidgetPreferenceUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplayQtUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplaySermonUseCase
import app.mannadev.meditation.model.BibleReferenceResolver
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface RNModuleDependencies {
    fun getSaveDisplaySermonUseCase(): SaveDisplaySermonUseCase
    fun getClearWidgetPreferences(): ClearWidgetPreferenceUseCase
    fun getSaveDisplayQtUseCase(): SaveDisplayQtUseCase
    fun getClearQtPreferences(): ClearQtPreferenceUseCase
    fun getBibleReferenceResolver(): BibleReferenceResolver
}

fun getRNModuleDependencies(context: Context): RNModuleDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        RNModuleDependencies::class.java
    )
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt \
         android/app/src/main/java/app/mannadev/meditation/di/RNModuleDependencies.kt
git commit -m "[ISSUE-54] feat(android): expose QT usecases via Hilt entry points"
```

---

## Task 8: Create QT widget error/loading XML layouts + strings

**Files:**
- Create: `android/app/src/main/res/layout/verse_widget_qt_small_loading.xml`
- Create: `android/app/src/main/res/layout/verse_widget_qt_small_error.xml`
- Create: `android/app/src/main/res/layout/verse_widget_qt_large_loading.xml`
- Create: `android/app/src/main/res/layout/verse_widget_qt_large_error.xml`
- Modify: `android/app/src/main/res/values/strings.xml`

- [ ] **Step 1: Copy existing sermon layouts to QT variants**

For each of the four files, first read the existing sermon equivalent, then copy content verbatim into the QT variant at the same resource `@layout/verse_widget_qt_*`. Nothing else changes — QT and Sermon widgets share the same error/loading UX.

Commands to inspect existing:
```bash
cat android/app/src/main/res/layout/verse_widget_small_loading.xml
cat android/app/src/main/res/layout/verse_widget_small_error.xml
cat android/app/src/main/res/layout/verse_widget_large_loading.xml
cat android/app/src/main/res/layout/verse_widget_large_error.xml
```

Write each as `verse_widget_qt_*` with identical contents.

- [ ] **Step 2: Add QT widget strings**

Append to `android/app/src/main/res/values/strings.xml` before `</resources>`:

```xml
    <string name="verse_widget_qt_small_name">Daily QT (Card)</string>
    <string name="verse_widget_qt_small_description">Display today\'s QT verse in a card type.</string>
    <string name="verse_widget_qt_large_name">Daily QT (Banner)</string>
    <string name="verse_widget_qt_large_description">Display today\'s QT verse in a banner type.</string>
```

- [ ] **Step 3: Verify resource compilation**

```bash
cd android && ./gradlew :app:processDebugResources
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/res/layout/verse_widget_qt_*.xml \
         android/app/src/main/res/values/strings.xml
git commit -m "[ISSUE-54] feat(android): add QT widget layout resources and strings"
```

---

## Task 9: Create QT widget Glance UI classes

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmallQt.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLargeQt.kt`

**Design note:** QT widgets render the same `Sermon` model shape (title + verses + bookName) by converting `QtDto` via the shared parser. Reusing `Sermon.fromDto` would require adapting `SermonDto` to accept a QT-origin, which is more coupling. Instead, convert `QtDto` → `SermonDto` (with `qt.seriesTitle + " / " + qt.title` as title) and reuse `Sermon.fromDto`.

- [ ] **Step 1: Create `VerseWidgetSmallQt.kt`**

```kotlin
package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
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
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
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
        val verse = qt?.let {
            Sermon.fromDto(
                SermonDto(
                    date = it.date,
                    title = if (it.seriesTitle.isNotBlank()) "${it.seriesTitle} / ${it.title}" else it.title,
                    content = it.content,
                    dayOfWeek = it.dayOfWeek,
                )
            )
        } ?: Sermon.errorSermon

        provideContent { VerseWidgetSmallQtContent(verse) }
    }
}

private object VerseSmallQtDimens {
    val appBarVerticalPadding = 20.dp
    val horizontalPadding = 24.dp
    val bookNameTopSpacer = 8.dp
    val contentBackgroundRadius = 16.dp
    val contentPadding = 12.dp
    val widgetPadding = 12.dp
}

@Composable
private fun VerseWidgetSmallQtContent(sermon: Sermon) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
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
            text = sermon.title,
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
            ) {
                LazyColumn(GlanceModifier.defaultWeight().fillMaxWidth()) {
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.contentPadding)) }
                    items(sermon.verses) { verse ->
                        Text(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = VerseSmallQtDimens.contentPadding)
                                .clickable(actionStartActivity<MainActivity>()),
                            text = verse,
                            style = Typography.bodyMedium,
                        )
                    }
                    item { Spacer(GlanceModifier.height(VerseSmallQtDimens.contentPadding)) }
                }
                Text(
                    modifier = GlanceModifier.padding(
                        top = VerseSmallQtDimens.bookNameTopSpacer,
                        start = VerseSmallQtDimens.contentPadding,
                        bottom = VerseSmallQtDimens.contentPadding,
                    ),
                    text = sermon.bookName,
                    style = Typography.labelSmall,
                )
            }
        }
    }
}
```

- [ ] **Step 2: Create `VerseWidgetLargeQt.kt`**

```kotlin
package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
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
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.R
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
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
        val verse = qt?.let {
            Sermon.fromDto(
                SermonDto(
                    date = it.date,
                    title = if (it.seriesTitle.isNotBlank()) "${it.seriesTitle} / ${it.title}" else it.title,
                    content = it.content,
                    dayOfWeek = it.dayOfWeek,
                )
            )
        } ?: Sermon.errorSermon

        provideContent { VerseWidgetLargeQtContent(verse) }
    }
}

private object VerseLargeQtDimens {
    val appBarVerticalPadding = 24.dp
    val horizontalPadding = 24.dp
    val bottomPadding = 24.dp
    val verseContentBottomSpacer = 16.dp
    val bookNameTopSpacer = 12.dp
}

@Composable
private fun VerseWidgetLargeQtContent(sermon: Sermon) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
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
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = sermon.title,
                style = Typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 2,
            )
        }
        LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) {
            items(sermon.verses) { verse ->
                Text(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(horizontal = VerseLargeQtDimens.horizontalPadding)
                        .clickable(actionStartActivity<MainActivity>()),
                    text = verse,
                    style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
            }
            item { Spacer(GlanceModifier.height(VerseLargeQtDimens.verseContentBottomSpacer)) }
        }
        Text(
            modifier = GlanceModifier.padding(
                start = VerseLargeQtDimens.horizontalPadding,
                top = VerseLargeQtDimens.bookNameTopSpacer,
                bottom = VerseLargeQtDimens.bottomPadding,
            ),
            text = sermon.bookName,
            style = Typography.labelMedium,
        )
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmallQt.kt \
         android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLargeQt.kt
git commit -m "[ISSUE-54] feat(android): add QT Glance widget UI (small + large)"
```

---

## Task 10: Create QT widget receivers + XML info + manifest

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/widget/QtWidgetSmallReceiver.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/widget/QtWidgetLargeReceiver.kt`
- Create: `android/app/src/main/res/xml/verse_widget_qt_small_info.xml`
- Create: `android/app/src/main/res/xml/verse_widget_qt_large_info.xml`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Create `QtWidgetSmallReceiver.kt`**

```kotlin
package app.mannadev.meditation.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.ui.widget.VerseWidgetSmallQt

class QtWidgetSmallReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = VerseWidgetSmallQt()
}
```

- [ ] **Step 2: Create `QtWidgetLargeReceiver.kt`**

```kotlin
package app.mannadev.meditation.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import app.mannadev.meditation.ui.widget.VerseWidgetLargeQt

class QtWidgetLargeReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = VerseWidgetLargeQt()
}
```

- [ ] **Step 3: Create `verse_widget_qt_small_info.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    android:description="@string/verse_widget_qt_small_description"
    android:initialLayout="@layout/verse_widget_qt_small_loading"
    android:minWidth="177dp"
    android:minHeight="115dp"
    android:previewImage="@drawable/verse_widget_small_preview_image"
    android:previewLayout="@layout/verse_widget_small_preview"
    android:resizeMode="horizontal|vertical"
    android:targetCellWidth="3"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen"
    tools:targetApi="31" />
```

Note: `previewImage` / `previewLayout` intentionally reuse sermon preview drawables to avoid new asset work in this phase.

- [ ] **Step 4: Create `verse_widget_qt_large_info.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    android:description="@string/verse_widget_qt_large_description"
    android:initialLayout="@layout/verse_widget_qt_large_loading"
    android:minWidth="245dp"
    android:minHeight="115dp"
    android:previewImage="@drawable/verse_widget_large_preview_image"
    android:previewLayout="@layout/verse_widget_large_preview"
    android:resizeMode="horizontal|vertical"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen"
    tools:targetApi="31" />
```

- [ ] **Step 5: Register receivers in `AndroidManifest.xml`**

Insert the two QT receivers after the existing `VerseWidgetLargeReceiver` block (before `<service ... MyFirebaseMessagingService ...>`):

```xml
        <receiver
            android:name=".widget.QtWidgetSmallReceiver"
            android:exported="true"
            android:label="@string/verse_widget_qt_small_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/verse_widget_qt_small_info" />
        </receiver>

        <receiver
            android:name=".widget.QtWidgetLargeReceiver"
            android:exported="true"
            android:label="@string/verse_widget_qt_large_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/verse_widget_qt_large_info" />
        </receiver>
```

- [ ] **Step 6: Verify build**

```bash
cd android && ./gradlew :app:assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/widget/Qt*.kt \
         android/app/src/main/res/xml/verse_widget_qt_*.xml \
         android/app/src/main/AndroidManifest.xml
git commit -m "[ISSUE-54] feat(android): register QT widget receivers in manifest"
```

---

## Task 11: Refactor `MyFirebaseMessagingService` (strict filter + v2 + QT branch)

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt`

**Design:** strict-match topic filter allows only `sermon_events_v2`, `qt_events` (and in DEBUG, their `_test` variants). Unknown topics including v1 `sermon_events` are dropped silently (no log, no Crashlytics). Sermon path reads `bible_references` instead of `content`. QT path parses `bible_references` + QT-specific fields, saves via `SaveDisplayQtUseCase`, updates QT widgets, writes `fcm_qt` AsyncStorage, broadcasts `ACTION_QT_UPDATE_EVENT`.

- [ ] **Step 1: Rewrite the service**

Replace the entire file with:

```kotlin
package app.mannadev.meditation.service

import android.annotation.SuppressLint
import android.content.Intent
import androidx.glance.appwidget.updateAll
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.BuildConfig
import app.mannadev.meditation.Constants.ACTION_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_QT
import app.mannadev.meditation.Constants.ASYNC_STORAGE_FCM_SERMON
import app.mannadev.meditation.Constants.QT_SUBJECT
import app.mannadev.meditation.Constants.SERMON_SUBJECT_V2
import app.mannadev.meditation.analytics.AnalyticsHelper
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.analytics.SermonEventSource
import app.mannadev.meditation.data.AsyncStorage
import app.mannadev.meditation.domain.usecase.SaveDisplayQtUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplaySermonUseCase
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetLargeQt
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetSmallQt
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import timber.log.Timber
import javax.inject.Inject

@SuppressLint("MissingFirebaseInstanceTokenRefresh") // topic 구독만 사용
@AndroidEntryPoint
class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val KEY_DATE = "date"
        private const val KEY_TITLE = "title"
        private const val KEY_SERIES_TITLE = "series_title"
        private const val KEY_CONTENT = "content"
        private const val KEY_BIBLE_REFERENCES = "bible_references"
        private const val KEY_DAY_OF_WEEK = "day_of_week"
        private const val KEY_TOPIC = "topic"

        private val ALLOWED_SERMON_TOPICS = setOf(SERMON_SUBJECT_V2, "sermon_events_v2_test")
        private val ALLOWED_QT_TOPICS = setOf(QT_SUBJECT, "qt_events_test")
    }

    @Inject lateinit var saveDisplaySermonUseCase: SaveDisplaySermonUseCase
    @Inject lateinit var saveDisplayQtUseCase: SaveDisplayQtUseCase
    @Inject lateinit var asyncStorage: AsyncStorage
    @Inject lateinit var bibleReferenceResolver: BibleReferenceResolver

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val topic = resolveTopic(message) ?: return // silent drop

        when {
            topic in ALLOWED_SERMON_TOPICS -> serviceScope.launch { consumeSermonEvent(message) }
            topic in ALLOWED_QT_TOPICS -> serviceScope.launch { consumeQtEvent(message) }
            else -> Unit // silent drop (v1 and anything unknown)
        }
    }

    /** Extracts topic name from `from` ("/topics/NAME") or `data.topic`. Returns null if neither resolves,
     *  and in DEBUG=false drops any `*_test` topic. */
    private fun resolveTopic(message: RemoteMessage): String? {
        val fromTopic = message.from?.removePrefix("/topics/")
        val dataTopic = message.data[KEY_TOPIC]
        val candidate = fromTopic ?: dataTopic ?: return null
        if (!BuildConfig.DEBUG && candidate.endsWith("_test")) return null
        return candidate
    }

    private suspend fun consumeSermonEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) return

        val sermonDto = runCatching { messageToSermonV2(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to parse sermon v2 data: ${message.data}")
            }
            .getOrNull() ?: return

        Timber.d("Parsed sermon v2: ${sermonDto.title}")

        runCatching {
            withContext(NonCancellable) {
                saveDisplaySermonUseCase(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save sermon v2: $sermonDto")
        }

        runCatching {
            VerseWidgetLarge().updateAll(applicationContext)
            VerseWidgetSmall().updateAll(applicationContext)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update sermon widgets")
        }

        runCatching {
            withContext(Dispatchers.IO) {
                val dataWithResolvedContent = message.data.toMutableMap().apply {
                    put(KEY_CONTENT, sermonDto.content)
                }
                asyncStorage.set(
                    key = ASYNC_STORAGE_FCM_SERMON,
                    value = Json.encodeToString(dataWithResolvedContent),
                )
            }
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(Intent(ACTION_SERMON_UPDATE_EVENT))
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update sermon AsyncStorage/broadcast")
        }
    }

    private suspend fun consumeQtEvent(message: RemoteMessage) {
        if (message.data.isEmpty()) return

        val qtDto = runCatching { messageToQt(message.data) }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Failed to parse qt data: ${message.data}")
            }
            .getOrNull() ?: return

        Timber.d("Parsed qt: ${qtDto.title}")

        runCatching {
            withContext(NonCancellable) {
                saveDisplayQtUseCase(qtDto)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save qt: $qtDto")
        }

        runCatching {
            VerseWidgetLargeQt().updateAll(applicationContext)
            VerseWidgetSmallQt().updateAll(applicationContext)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update qt widgets")
        }

        runCatching {
            withContext(Dispatchers.IO) {
                val dataWithResolvedContent = message.data.toMutableMap().apply {
                    put(KEY_CONTENT, qtDto.content)
                }
                asyncStorage.set(
                    key = ASYNC_STORAGE_FCM_QT,
                    value = Json.encodeToString(dataWithResolvedContent),
                )
            }
            LocalBroadcastManager
                .getInstance(this@MyFirebaseMessagingService)
                .sendBroadcast(Intent(ACTION_QT_UPDATE_EVENT))
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to update qt AsyncStorage/broadcast")
        }
    }

    private fun messageToSermonV2(data: Map<String, String>): SermonDto {
        val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in sermon v2")
        val title = data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in sermon v2")
        val bibleRefsJson = data[KEY_BIBLE_REFERENCES]
            ?: throw IllegalArgumentException("Missing 'bible_references' in sermon v2")
        val dayOfWeek = data[KEY_DAY_OF_WEEK]
            ?: throw IllegalArgumentException("Missing 'day_of_week' in sermon v2")

        val content = bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson)

        return SermonDto(date = date, title = title, content = content, dayOfWeek = dayOfWeek)
    }

    private fun messageToQt(data: Map<String, String>): QtDto {
        val date = data[KEY_DATE] ?: throw IllegalArgumentException("Missing 'date' in qt")
        val title = data[KEY_TITLE] ?: throw IllegalArgumentException("Missing 'title' in qt")
        val seriesTitle = data[KEY_SERIES_TITLE] ?: ""
        val bibleRefsJson = data[KEY_BIBLE_REFERENCES]
            ?: throw IllegalArgumentException("Missing 'bible_references' in qt")
        val dayOfWeek = data[KEY_DAY_OF_WEEK]
            ?: throw IllegalArgumentException("Missing 'day_of_week' in qt")

        val content = bibleReferenceResolver.resolveBibleReferencesJson(bibleRefsJson)

        return QtDto(
            date = date,
            title = title,
            seriesTitle = seriesTitle,
            content = content,
            dayOfWeek = dayOfWeek,
        )
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt
git commit -m "[ISSUE-54] refactor(android): strict topic filter + v2 sermon + qt_events branch

- Drop v1 sermon_events messages silently (no log, no Crashlytics)
- Sermon path: parse bible_references via BibleReferenceResolver
- QT path: parallel pipeline writing qt prefs, qt widgets, fcm_qt AsyncStorage, QT broadcast"
```

---

## Task 12: Extend `WidgetUpdateModule` (RN bridge) with `resolveBibleReferences` + `onQtUpdated`

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/rnmodule/WidgetUpdateModule.kt`

- [ ] **Step 1: Add two new `@ReactMethod` entries**

Append inside the `WidgetUpdateModule` class, after `onSermonUpdated` and before `updateWidgets()`:

```kotlin
    @Suppress("unused")
    @Keep
    @ReactMethod
    fun resolveBibleReferences(jsonString: String, promise: Promise) {
        moduleScope.launch {
            runCatching {
                val resolver = moduleDependencies.getBibleReferenceResolver()
                resolver.resolveBibleReferencesJson(jsonString)
            }
                .onSuccess { promise.resolve(it) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "resolveBibleReferences failed for: $jsonString",
                        tag = TAG,
                    )
                    promise.reject("RESOLVE_BIBLE_REFERENCES_ERROR", e.message, e)
                }
        }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onQtUpdated(qtData: String, promise: Promise) {
        moduleScope.launch {
            val saveResult = runCatching {
                log.d("Saving QT to Widget Preference...")
                val saveQtUseCase = moduleDependencies.getSaveDisplayQtUseCase()
                val qtDto = json.decodeFromString<app.mannadev.meditation.dto.QtDto>(qtData)
                saveQtUseCase(qtDto)
                log.d("QT saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(e, "Error saving QT data: ${e.message}", tag = TAG)
            }

            runCatching { updateQtWidgets() }
                .onFailure {
                    CrashlyticsHelper.recordException(
                        it,
                        "Error updating QT widgets after saving: ${it.message}",
                        tag = TAG,
                    )
                }

            saveResult
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    promise.reject("QT_UPDATE_ERROR", e.message, e)
                }
        }
    }

    private suspend fun updateQtWidgets() {
        val context = reactApplicationContext
        log.d("Updating QT widgets...")
        app.mannadev.meditation.ui.widget.VerseWidgetLargeQt().updateAll(context)
        app.mannadev.meditation.ui.widget.VerseWidgetSmallQt().updateAll(context)
    }
```

- [ ] **Step 2: Verify compilation**

```bash
cd android && ./gradlew :app:compileDebugKotlin
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/rnmodule/WidgetUpdateModule.kt
git commit -m "[ISSUE-54] feat(android-bridge): expose resolveBibleReferences and onQtUpdated to RN"
```

---

## Task 13: Extend `NativeEventModule` to forward QT broadcasts to RN

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/rnmodule/NativeEventModule.kt`

- [ ] **Step 1: Register for QT action, emit `ON_QT_UPDATE` JS event**

Replace the file with:

```kotlin
package app.mannadev.meditation.rnmodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import app.mannadev.meditation.Constants.ACTION_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.ACTION_SERMON_UPDATE_EVENT
import app.mannadev.meditation.Constants.MESSAGE_QT_UPDATE_EVENT
import app.mannadev.meditation.Constants.MESSAGE_SERMON_UPDATE_EVENT
import app.mannadev.meditation.analytics.CrashlyticsHelper
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.DeviceEventManagerModule
import timber.log.Timber

class NativeEventModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MyEventModule"

    override fun initialize() {
        super.initialize()
        val broadcastManager = LocalBroadcastManager.getInstance(reactApplicationContext)
        broadcastManager.registerReceiver(sermonReceiver, IntentFilter(ACTION_SERMON_UPDATE_EVENT))
        broadcastManager.registerReceiver(qtReceiver, IntentFilter(ACTION_QT_UPDATE_EVENT))
    }

    override fun invalidate() {
        super.invalidate()
        val broadcastManager = LocalBroadcastManager.getInstance(reactApplicationContext)
        broadcastManager.unregisterReceiver(sermonReceiver)
        broadcastManager.unregisterReceiver(qtReceiver)
    }

    private val sermonReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Timber.d("Received broadcast: ${intent?.action}")
            sendEventToJS(MESSAGE_SERMON_UPDATE_EVENT)
        }
    }

    private val qtReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Timber.d("Received broadcast: ${intent?.action}")
            sendEventToJS(MESSAGE_QT_UPDATE_EVENT)
        }
    }

    fun sendEventToJS(eventName: String, params: WritableMap? = null) {
        if (reactApplicationContext.lifecycleState == LifecycleState.BEFORE_CREATE) return
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Timber.e(e, "Failed to send event to JS: $eventName")
            CrashlyticsHelper.recordException(e, "Failed to send event to JS: $eventName")
        }
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd android && ./gradlew :app:assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/rnmodule/NativeEventModule.kt
git commit -m "[ISSUE-54] feat(android-bridge): forward QT broadcast to RN as ON_QT_UPDATE event"
```

---

## Task 14: Update `WidgetUpdateModule` RN type definition

**Files:**
- Modify: `src/types/WidgetUpdateModule.ts`

- [ ] **Step 1: Add new method signatures**

Final file:
```ts
import { NativeModules } from 'react-native';

interface WidgetUpdateModuleInterface {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onQtUpdated(qtData: string): Promise<boolean>;
  resolveBibleReferences(jsonString: string): Promise<string>;
  onClear(): Promise<void>;
  getAppGroupData(key: string): Promise<string | null>;
  setYoutubeLinkEnabled(enabled: boolean): Promise<void>;
  getYoutubeLinkEnabled(): Promise<boolean>;
}

const { WidgetUpdateModule } = NativeModules;

export default WidgetUpdateModule as WidgetUpdateModuleInterface;
```

- [ ] **Step 2: Commit**

```bash
git add src/types/WidgetUpdateModule.ts
git commit -m "[ISSUE-54] feat(types): add resolveBibleReferences and onQtUpdated to bridge type"
```

---

## Task 15: Update `Sermon.ts` — add `video_url` and `bible_references`, make `firestoreDocToSermon` async

**Files:**
- Modify: `src/types/Sermon.ts`
- Modify: `__tests__/Sermon.test.ts`

- [ ] **Step 1: Add failing tests for new behavior**

Append to `__tests__/Sermon.test.ts`:

```ts
import { Platform } from 'react-native';

jest.mock('../src/types/WidgetUpdateModule', () => ({
  __esModule: true,
  default: {
    resolveBibleReferences: jest.fn(),
  },
}));

describe('firestoreDocToSermon (async)', () => {
  const { firestoreDocToSermon } = require('../src/types/Sermon');
  const bridge = require('../src/types/WidgetUpdateModule').default;

  const makeDoc = (data: any) => ({ id: 'doc-1', data: () => data });

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  it('on Android calls bridge with bible_references and returns resolved content', async () => {
    bridge.resolveBibleReferences.mockResolvedValue('본문 : 창세기 1:1 태초에');
    const doc = makeDoc({
      title: 'T',
      date: '2026-04-17',
      bible_references: [{ book: '창세기', chapter: 1, verse_start: 1, verse_end: 1 }],
      video_url: 'https://youtu.be/abc',
    });
    const result = await firestoreDocToSermon(doc);
    expect(bridge.resolveBibleReferences).toHaveBeenCalledWith(
      JSON.stringify(doc.data().bible_references),
    );
    expect(result.content).toBe('본문 : 창세기 1:1 태초에');
    expect(result.video_url).toBe('https://youtu.be/abc');
  });

  it('on iOS returns empty content without calling bridge', async () => {
    (Platform as any).OS = 'ios';
    const doc = makeDoc({
      title: 'T',
      date: '2026-04-17',
      bible_references: [{ book: '창세기', chapter: 1, verse_start: 1, verse_end: 1 }],
    });
    const result = await firestoreDocToSermon(doc);
    expect(bridge.resolveBibleReferences).not.toHaveBeenCalled();
    expect(result.content).toBe('');
  });

  it('returns empty content when bridge rejects (graceful degrade)', async () => {
    bridge.resolveBibleReferences.mockRejectedValue(new Error('boom'));
    const doc = makeDoc({
      title: 'T',
      date: '2026-04-17',
      bible_references: [{ book: '창세기', chapter: 1, verse_start: 1, verse_end: 1 }],
    });
    const result = await firestoreDocToSermon(doc);
    expect(result.content).toBe('');
  });

  it('returns empty content when bible_references missing', async () => {
    const doc = makeDoc({ title: 'T', date: '2026-04-17' });
    const result = await firestoreDocToSermon(doc);
    expect(result.content).toBe('');
    expect(bridge.resolveBibleReferences).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/Sermon.test.ts
```

Expected: the 4 new tests fail (function is sync, no video_url, no bridge use).

- [ ] **Step 3: Update `src/types/Sermon.ts`**

Replace `firestoreDocToSermon` and `Sermon` interface. Key edits:

Update the `Sermon` interface to include `video_url`:
```ts
export interface Sermon {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
  day_of_week?: string;
  video_url?: string;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}
```

Update `SermonRaw` to include v2 fields:
```ts
export interface SermonRaw {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
  day_of_week?: string;
  dayOfWeek?: string;
  bible_references?: string;
  video_url?: string;
  source_id?: string;
  created_at?: FirestoreTimestamp | string;
  createdAt?: FirestoreTimestamp | string;
  updated_at?: FirestoreTimestamp | string;
  updatedAt?: FirestoreTimestamp | string;
}
```

Update `fcmDataToSermon` return object to pass through `video_url`:
```ts
export function fcmDataToSermon(raw: SermonRaw): Sermon {
  return {
    id: raw.id || '',
    title: raw.title || '',
    content: raw.content || '',
    date: raw.date || '',
    category: raw.category,
    day_of_week: raw.day_of_week || raw.dayOfWeek,
    video_url: raw.video_url,
    created_at: resolveTimestamp(raw.created_at, raw.createdAt),
    updated_at: resolveTimestamp(raw.updated_at, raw.updatedAt),
  };
}
```

Add imports at top of file:
```ts
import { Platform } from 'react-native';
import WidgetUpdateModule from './WidgetUpdateModule';
```

Replace `firestoreDocToSermon` with async version:
```ts
export const firestoreDocToSermon = async (
  doc: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): Promise<Sermon> => {
  const firestoreData = doc.data();

  let content = firestoreData.content || '';
  const bibleRefs = firestoreData.bible_references;
  if (Platform.OS === 'android' && bibleRefs) {
    try {
      const resolved = await WidgetUpdateModule.resolveBibleReferences(
        JSON.stringify(bibleRefs),
      );
      content = resolved;
    } catch (e) {
      logger.error('firestoreDocToSermon: bridge resolveBibleReferences failed', e);
      content = '';
    }
  } else if (Platform.OS === 'ios' && bibleRefs) {
    content = '';
  }

  return {
    id: doc.id,
    title: firestoreData.title || '',
    content,
    date: firestoreData.date || new Date().toISOString().split('T')[0],
    category: firestoreData.category || '',
    day_of_week: firestoreData.day_of_week || '',
    video_url: firestoreData.video_url,
    created_at: firestoreData.created_at || { seconds: 0, nanoseconds: 0 },
    updated_at: firestoreData.updated_at || { seconds: 0, nanoseconds: 0 },
  };
};
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/Sermon.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/Sermon.ts __tests__/Sermon.test.ts
git commit -m "[ISSUE-54] feat(types): async firestoreDocToSermon via bridge, add video_url"
```

---

## Task 16: Update `sermonService.ts` to await async `firestoreDocToSermon`

**Files:**
- Modify: `src/services/sermonService.ts`

- [ ] **Step 1: Add `await` at the two call sites**

In `fetchLatestSermonFromCache`:
```ts
return snapshot.empty ? null : await firestoreDocToSermon(snapshot.docs[0]);
```

In `fetchLatestSermonFromServer`:
```ts
return await firestoreDocToSermon(snapshot.docs[0]);
```

- [ ] **Step 2: Run existing tests**

```bash
npx jest __tests__/sermonService.test.ts __tests__/Sermon.test.ts
```

Expected: all existing tests pass. If `sermonService.test.ts` fails, verify its mock of `WidgetUpdateModule` (currently `jest.mock('../src/types/WidgetUpdateModule', () => null);`) — this still works because the affected code paths only touch `firestoreDocToSermon` for cache/server, which these tests don't exercise.

- [ ] **Step 3: Commit**

```bash
git add src/services/sermonService.ts
git commit -m "[ISSUE-54] fix(services): await async firestoreDocToSermon"
```

---

## Task 17: Create `src/types/QT.ts` (TDD)

**Files:**
- Create: `src/types/QT.ts`
- Create: `__tests__/QT.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/QT.test.ts`:

```ts
import { Platform } from 'react-native';
import {
  compareQt,
  fcmDataToQt,
  firestoreDocToQt,
  QT,
  QTRaw,
} from '../src/types/QT';

jest.mock('../src/types/WidgetUpdateModule', () => ({
  __esModule: true,
  default: {
    resolveBibleReferences: jest.fn(),
  },
}));

describe('fcmDataToQt', () => {
  it('maps snake_case fields to QT', () => {
    const raw: QTRaw = {
      id: 'q-1',
      title: 'QT title',
      series_title: 'Series',
      content: 'Body',
      date: '2026-04-17',
      day_of_week: 'FRI',
    };
    const result = fcmDataToQt(raw);
    expect(result.id).toBe('q-1');
    expect(result.series_title).toBe('Series');
    expect(result.content).toBe('Body');
  });

  it('defaults missing fields to empty strings', () => {
    const raw = {} as QTRaw;
    const result = fcmDataToQt(raw);
    expect(result.title).toBe('');
    expect(result.series_title).toBe('');
    expect(result.content).toBe('');
  });

  it('preserves video_url when present', () => {
    const raw: QTRaw = {
      id: '1', title: 'T', series_title: '', content: 'C', date: '2026-04-17',
      video_url: 'https://youtu.be/xyz',
    };
    expect(fcmDataToQt(raw).video_url).toBe('https://youtu.be/xyz');
  });
});

describe('compareQt', () => {
  const makeQt = (date: string, updatedSeconds = 0): QT => ({
    id: '1',
    title: 'T',
    series_title: 'S',
    content: 'C',
    date,
    created_at: { seconds: 0, nanoseconds: 0 },
    updated_at: { seconds: updatedSeconds, nanoseconds: 0 },
  });

  it('returns 0 for both null', () => {
    expect(compareQt(null, null)).toBe(0);
  });

  it('prefers later date', () => {
    expect(compareQt(makeQt('2026-04-17'), makeQt('2026-04-16'))).toBe(1);
  });

  it('compares updated_at when dates equal', () => {
    expect(compareQt(makeQt('2026-04-17', 200), makeQt('2026-04-17', 100))).toBe(1);
  });
});

describe('firestoreDocToQt', () => {
  const bridge = require('../src/types/WidgetUpdateModule').default;
  const makeDoc = (data: any) => ({ id: 'doc-q', data: () => data });

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  it('on Android resolves content via bridge', async () => {
    bridge.resolveBibleReferences.mockResolvedValue('본문 : 에베소서 5:15-16 RESOLVED');
    const doc = makeDoc({
      title: 'T',
      series_title: 'Daily',
      date: '2026-04-17',
      bible_references: [{ book: '에베소서', chapter: 5, verse_start: 15, verse_end: 16 }],
    });
    const result = await firestoreDocToQt(doc);
    expect(result.content).toBe('본문 : 에베소서 5:15-16 RESOLVED');
  });

  it('on iOS returns empty content', async () => {
    (Platform as any).OS = 'ios';
    const doc = makeDoc({
      title: 'T', series_title: 'Daily', date: '2026-04-17',
      bible_references: [{ book: '에베소서', chapter: 5, verse_start: 15, verse_end: 16 }],
    });
    const result = await firestoreDocToQt(doc);
    expect(result.content).toBe('');
  });
});
```

- [ ] **Step 2: Run test — expect module-not-found failure**

```bash
npx jest __tests__/QT.test.ts
```

Expected: FAIL — `Cannot find module '../src/types/QT'`.

- [ ] **Step 3: Create `src/types/QT.ts`**

```ts
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { convertStringToTimestamp, FirestoreTimestamp } from './Sermon';
import WidgetUpdateModule from './WidgetUpdateModule';
import logger from '../utils/logger';

export const FCM_QT_KEY = 'fcm_qt';

export interface QT {
  id: string;
  title: string;
  series_title: string;
  content: string;
  date: string;
  day_of_week?: string;
  video_url?: string;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

export interface QTRaw {
  id: string;
  title: string;
  series_title: string;
  content: string;
  date: string;
  day_of_week?: string;
  dayOfWeek?: string;
  bible_references?: string;
  meditation_questions?: string;
  video_url?: string;
  source_id?: string;
  created_at?: FirestoreTimestamp | string;
  createdAt?: FirestoreTimestamp | string;
  updated_at?: FirestoreTimestamp | string;
  updatedAt?: FirestoreTimestamp | string;
}

function resolveTimestamp(
  snakeCase: FirestoreTimestamp | string | undefined,
  camelCase: FirestoreTimestamp | string | undefined,
): FirestoreTimestamp {
  if (typeof snakeCase === 'string') return convertStringToTimestamp(snakeCase);
  if (typeof camelCase === 'string') return convertStringToTimestamp(camelCase);
  return snakeCase || camelCase || { seconds: 0, nanoseconds: 0 };
}

export function fcmDataToQt(raw: QTRaw): QT {
  return {
    id: raw.id || '',
    title: raw.title || '',
    series_title: raw.series_title || '',
    content: raw.content || '',
    date: raw.date || '',
    day_of_week: raw.day_of_week || raw.dayOfWeek,
    video_url: raw.video_url,
    created_at: resolveTimestamp(raw.created_at, raw.createdAt),
    updated_at: resolveTimestamp(raw.updated_at, raw.updatedAt),
  };
}

export const firestoreDocToQt = async (
  doc: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): Promise<QT> => {
  const data = doc.data();
  let content = data.content || '';
  const bibleRefs = data.bible_references;
  if (Platform.OS === 'android' && bibleRefs) {
    try {
      content = await WidgetUpdateModule.resolveBibleReferences(JSON.stringify(bibleRefs));
    } catch (e) {
      logger.error('firestoreDocToQt: bridge resolveBibleReferences failed', e);
      content = '';
    }
  } else if (Platform.OS === 'ios' && bibleRefs) {
    content = '';
  }
  return {
    id: doc.id,
    title: data.title || '',
    series_title: data.series_title || '',
    content,
    date: data.date || new Date().toISOString().split('T')[0],
    day_of_week: data.day_of_week || '',
    video_url: data.video_url,
    created_at: data.created_at || { seconds: 0, nanoseconds: 0 },
    updated_at: data.updated_at || { seconds: 0, nanoseconds: 0 },
  };
};

function toMillis(t: FirestoreTimestamp | string | null | undefined): number {
  if (!t) return 0;
  if (typeof t === 'string') {
    const parsed = convertStringToTimestamp(t);
    return parsed.seconds * 1000 + Math.floor(parsed.nanoseconds / 1_000_000);
  }
  if (typeof t === 'object' && 'seconds' in t) {
    return t.seconds * 1000 + Math.floor(t.nanoseconds / 1_000_000);
  }
  return 0;
}

export function compareQt(a: QT | null, b: QT | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (a.date > b.date) return 1;
  if (a.date < b.date) return -1;
  const aTime = toMillis(a.updated_at);
  const bTime = toMillis(b.updated_at);
  return aTime > bTime ? 1 : aTime < bTime ? -1 : 0;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/QT.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/QT.ts __tests__/QT.test.ts
git commit -m "[ISSUE-54] feat(types): add QT type with FCM/Firestore/compare helpers"
```

---

## Task 18: Create `src/services/qtService.ts` (TDD)

**Files:**
- Create: `src/services/qtService.ts`
- Create: `__tests__/qtService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/qtService.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestQtFromAsyncStorage,
  isQtDataStale,
} from '../src/services/qtService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({}));

jest.mock('../src/types/WidgetUpdateModule', () => null);

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('isQtDataStale', () => {
  it('returns true when date is null', () => {
    expect(isQtDataStale(null)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isQtDataStale(new Date())).toBe(false);
  });

  it('returns true for date older than 7-day default', () => {
    const old = new Date();
    old.setDate(old.getDate() - 8);
    expect(isQtDataStale(old)).toBe(true);
  });
});

describe('fetchLatestQtFromAsyncStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when AsyncStorage empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await fetchLatestQtFromAsyncStorage();
    expect(result).toBeNull();
  });

  it('parses valid QT JSON', async () => {
    const qt = { id: 'q1', title: 'QT', series_title: 'S', content: 'C', date: '2026-04-17' };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(qt));
    const result = await fetchLatestQtFromAsyncStorage();
    expect(result!.id).toBe('q1');
    expect(result!.series_title).toBe('S');
  });

  it('returns null for invalid JSON', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-json{{{');
    const result = await fetchLatestQtFromAsyncStorage();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect module not found**

```bash
npx jest __tests__/qtService.test.ts
```

Expected: FAIL — `Cannot find module '../src/services/qtService'`.

- [ ] **Step 3: Create `src/services/qtService.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocsFromCache,
  getDocsFromServer,
  getFirestore,
  limit,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import { STALE_DATA_THRESHOLD_DAYS } from '../constants';
import {
  FCM_QT_KEY,
  fcmDataToQt,
  firestoreDocToQt,
  QT,
  QTRaw,
} from '../types/QT';
import logger from '../utils/logger';

export async function fetchLatestQtFromCache(): Promise<QT | null> {
  try {
    const db = getFirestore();
    const q = query(collection(db, 'qt'), orderBy('date', 'desc'), limit(1));
    const snapshot = await getDocsFromCache(q);
    return snapshot.empty ? null : await firestoreDocToQt(snapshot.docs[0]);
  } catch (error) {
    logger.error('Failed to load QT from Firestore cache', error);
    return null;
  }
}

export async function fetchLatestQtFromAsyncStorage(): Promise<QT | null> {
  try {
    const raw = await AsyncStorage.getItem(FCM_QT_KEY);
    if (raw) {
      return fcmDataToQt(JSON.parse(raw) as QTRaw);
    }
  } catch (error) {
    logger.error('Failed to load QT from AsyncStorage', error);
  }
  return null;
}

export async function fetchLatestQtFromServer(): Promise<QT | null> {
  const db = getFirestore();
  const q = query(collection(db, 'qt'), orderBy('date', 'desc'), limit(1));
  const snapshot = await getDocsFromServer(q);
  if (snapshot.empty) {
    logger.log('No QT found on server');
    return null;
  }
  return await firestoreDocToQt(snapshot.docs[0]);
}

export function isQtDataStale(
  qtDate: Date | null,
  thresholdDays: number = STALE_DATA_THRESHOLD_DAYS,
): boolean {
  if (qtDate == null) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);
  return qtDate <= cutoff;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/qtService.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/qtService.ts __tests__/qtService.test.ts
git commit -m "[ISSUE-54] feat(services): add qtService with Firestore + AsyncStorage + staleness"
```

---

## Task 19: Create `useQtData` hook

**Files:**
- Create: `src/hooks/useQtData.ts`

- [ ] **Step 1: Create hook, mirroring `useSermonData` shape**

```ts
import { useCallback, useState } from 'react';
import { compareQt, QT } from '../types/QT';
import {
  fetchLatestQtFromAsyncStorage,
  fetchLatestQtFromCache,
  fetchLatestQtFromServer,
} from '../services/qtService';
import logger from '../utils/logger';

export interface UseQtDataReturn {
  qt: QT | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  loadLocalData: () => Promise<QT | null>;
  fetchFromServer: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function useQtData(): UseQtDataReturn {
  const [qt, setQt] = useState<QT | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocalData = useCallback(async (): Promise<QT | null> => {
    try {
      const [firestoreCache, asyncStorageCache] = await Promise.all([
        fetchLatestQtFromCache(),
        fetchLatestQtFromAsyncStorage(),
      ]);

      if (!firestoreCache && !asyncStorageCache) {
        setQt(null);
        return null;
      }

      const result = compareQt(firestoreCache, asyncStorageCache);
      const selected = result >= 0 ? firestoreCache : asyncStorageCache;
      setQt(selected);
      setError(null);
      return selected;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to load QT local data:', e);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFromServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchLatestQtFromServer();
      if (result) setQt(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to fetch QT from server:', e);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchFromServer();
  }, [fetchFromServer]);

  return { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQtData.ts
git commit -m "[ISSUE-54] feat(hooks): add useQtData hook mirroring useSermonData"
```

---

## Task 20: Create `useQtWidgetSync` + `useQtFCMListener` hooks

**Files:**
- Create: `src/hooks/useQtWidgetSync.ts`
- Create: `src/hooks/useQtFCMListener.ts`

- [ ] **Step 1: Create `useQtWidgetSync.ts`**

```ts
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
    WidgetUpdateModule.onQtUpdated(JSON.stringify(qt)).catch((error) => {
      logger.error('Failed to update QT widget:', error);
    });
  }, [qt]);
}
```

- [ ] **Step 2: Create `useQtFCMListener.ts`**

```ts
import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import logger from '../utils/logger';

export function useQtFCMListener(onUpdate: () => void | Promise<unknown>): void {
  useEffect(() => {
    const { MyEventModule } = NativeModules;
    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }
    const emitter = new NativeEventEmitter(MyEventModule);
    const sub = emitter.addListener('ON_QT_UPDATE', () => {
      logger.log(`${Platform.OS} FCM QT update received`);
      onUpdate();
    });
    return () => sub.remove();
  }, [onUpdate]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQtWidgetSync.ts src/hooks/useQtFCMListener.ts
git commit -m "[ISSUE-54] feat(hooks): add useQtWidgetSync and useQtFCMListener"
```

---

## Task 21: Update `jest.setup.js` with WidgetUpdateModule mock

**Files:**
- Modify: `jest.setup.js`

**Rationale:** Task 15/17 tests individually mock the module, but global mock avoids repetition and prevents accidental calls to undefined methods in other tests.

- [ ] **Step 1: Append mock to `jest.setup.js`**

Add to the end of the file:

```js
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    NativeModules: {
      ...actual.NativeModules,
      WidgetUpdateModule: {
        onSermonUpdated: jest.fn().mockResolvedValue(true),
        onQtUpdated: jest.fn().mockResolvedValue(true),
        resolveBibleReferences: jest.fn().mockResolvedValue(''),
        onClear: jest.fn().mockResolvedValue(undefined),
        getAppGroupData: jest.fn().mockResolvedValue(null),
        setYoutubeLinkEnabled: jest.fn().mockResolvedValue(undefined),
        getYoutubeLinkEnabled: jest.fn().mockResolvedValue(false),
      },
      MyEventModule: { getName: () => 'MyEventModule' },
    },
    Platform: { ...actual.Platform, OS: 'android' },
  };
});
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest
```

Expected: all tests pass. If any test that previously did `jest.mock('../src/types/WidgetUpdateModule', () => null)` conflicts, leave those in place — individual file-scoped mocks override the global one.

- [ ] **Step 3: Commit**

```bash
git add jest.setup.js
git commit -m "[ISSUE-54] test: add global WidgetUpdateModule mock for jest"
```

---

## Task 22: Rewrite `DailyMannaScreen.tsx` with QT data pipeline

**Files:**
- Modify: `src/screens/DailyMannaScreen.tsx`

**UX:** Mirrors HomeScreen structure (header + scrollable content + YouTube link at bottom). Uses QT data. If `qt.video_url` is missing, fallback to channel URL.

- [ ] **Step 1: Replace file content**

```tsx
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { useQtData } from '../hooks/useQtData';
import { useQtFCMListener } from '../hooks/useQtFCMListener';
import { useQtWidgetSync } from '../hooks/useQtWidgetSync';
import { isQtDataStale } from '../services/qtService';
import { RootStackParamList } from '../types/navigation';
import { extractContent } from '../utils/sermonParser';
import logger from '../utils/logger';
import { processTitleText } from '../utils/textFormatting';

const DAILY_MANNA_CHANNEL_URL = 'https://www.youtube.com/@만나';

const DailyMannaScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useQtData();

  useQtWidgetSync(qt);
  useQtFCMListener(loadLocalData);

  const qtContent = useMemo(
    () => (qt?.content ? extractContent(qt.content) : { index: '', content: '' }),
    [qt?.content],
  );

  const targetYoutubeUrl = qt?.video_url || DAILY_MANNA_CHANNEL_URL;

  const openYoutube = () => {
    Linking.openURL(targetYoutubeUrl).catch((e) =>
      logger.error('DailyMannaScreen: YouTube 링크 열기 실패', e),
    );
  };

  useEffect(() => {
    const init = async () => {
      const loaded = await loadLocalData();
      const latestDate = loaded?.date ? new Date(loaded.date) : null;
      if (isQtDataStale(latestDate)) {
        await fetchFromServer();
      }
    };
    init().catch((e) => {
      logger.error('DailyMannaScreen init failed:', e);
      setIsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading && !qt) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator size="large" color="#A59EAE" />
      </SafeAreaView>
    );
  }

  if (error && !qt) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Image
          source={require('../assets/image/20250416_meditation_icon.png')}
          style={styles.icon}
        />
        <Text style={styles.appTitle}>묵상만개</Text>
        <TouchableOpacity onPress={openYoutube} style={styles.youtubeButton}>
          <SvgIcon name="YoutubeButton" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('SettingsScreen', { onRefresh })}
          style={styles.settingsButton}
        >
          <SvgIcon name="SettingButton" size={20} color="black" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.dateText}>{qt?.date}</Text>
        {qt?.series_title ? (
          <Text style={styles.seriesTitleText}>{qt.series_title}</Text>
        ) : null}
        <Text style={styles.titleText} numberOfLines={0}>
          {processTitleText(qt?.title)}
        </Text>
        <Text style={styles.indexText}>{qtContent.index}</Text>
        <Text style={styles.contentText}>{qtContent.content}</Text>
        <TouchableOpacity style={styles.youtubeLinkContainer} onPress={openYoutube}>
          <SvgIcon name="YoutubeButton" size={20} />
          <Text style={styles.youtubeLinkText}>YouTube 영상 바로가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 35,
    marginTop: 35,
  },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    height: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  icon: {
    backgroundColor: 'transparent',
    borderRadius: 15,
    width: 20,
    height: 20,
  },
  appTitle: {
    color: '#49454F',
    fontSize: 20,
    fontFamily: 'Pretendard-Medium',
    marginLeft: 8,
  },
  youtubeButton: { marginLeft: 'auto', padding: 2 },
  settingsButton: { marginLeft: 8 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  dateText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  seriesTitleText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 4,
  },
  titleText: {
    color: '#A59EAE',
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  indexText: {
    color: '#49454F',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  contentText: {
    color: '#49454F',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 26,
    marginBottom: 32,
  },
  youtubeLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youtubeLinkText: {
    color: '#A59EAE',
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  errorContainer: { justifyContent: 'center', alignItems: 'center' },
  errorText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 16,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#A59EAE',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
  },
});

export default DailyMannaScreen;
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/DailyMannaScreen.tsx
git commit -m "[ISSUE-54] feat(screens): replace DailyManna placeholder with QT content"
```

---

## Task 23: Update `HomeScreen.tsx` — YouTube URL from `sermon.video_url`

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Read current file and plan the change**

The current screen hardcodes `SUNDAY_SERMON_YOUTUBE_URL = 'https://www.youtube.com/@만나'`. Change both YouTube tap handlers to use `sermon?.video_url` with channel URL as fallback.

- [ ] **Step 2: Apply edits**

Keep the top constant as the fallback URL. Add `targetYoutubeUrl` before `return`:

Insert after `useFCMListener(loadLocalData);` (around line 46):
```tsx
  const targetYoutubeUrl = sermon?.video_url || SUNDAY_SERMON_YOUTUBE_URL;
```

Replace both `Linking.openURL(SUNDAY_SERMON_YOUTUBE_URL)` occurrences with `Linking.openURL(targetYoutubeUrl)`.

- [ ] **Step 3: Verify TypeScript + lint + existing tests**

```bash
npx tsc --noEmit
yarn lint
npx jest
```

Expected: no errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "[ISSUE-54] feat(screens): route HomeScreen YouTube taps to sermon.video_url"
```

---

## Task 24: Full build + smoke-test scripted verification

**Files:** (no file changes — verification only)

- [ ] **Step 1: Full Android build**

```bash
cd android && ./gradlew :app:assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: Full Android unit tests**

```bash
cd android && ./gradlew :app:testDebugUnitTest
```

Expected: BUILD SUCCESSFUL, all tests pass.

- [ ] **Step 3: Full JS test suite**

```bash
npx jest
```

Expected: all tests pass. Note the count — should be previous count + tests added in Tasks 15, 17, 18.

- [ ] **Step 4: JS lint**

```bash
yarn lint
```

Expected: no errors.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: If any check fails, stop and fix before proceeding.** Do NOT commit a green-ish state; everything must be green.

---

## Task 25: Manual device verification (Android)

**Files:** (no file changes — manual checks)

Environment: Debug build on an Android device or emulator signed into Firebase (Crashlytics/FCM).

- [ ] **Step 1: Install fresh debug build and observe Logcat for topic migration**

```bash
cd android && ./gradlew :app:installDebug
adb logcat -s Timber:* MyFirebaseMessagingService:* MainApplication:*
```

Expected within a few seconds of app launch:
- `Successfully unsubscribed from sermon_events topic`
- `Successfully subscribed to sermon_events_v2 topic`
- `Successfully subscribed to qt_events topic`

Capture Logcat — save to a file if possible.

- [ ] **Step 2: Send a test v2 sermon push (Firebase console → Messaging → topic `sermon_events_v2_test`)**

Payload (data message):
```
date: 2026-04-17
title: Smoke test sermon
bible_references: [{"book":"요한복음","chapter":3,"verse_start":16,"verse_end":16}]
day_of_week: FRI
topic: sermon_events_v2_test
```

Expected:
- Logcat: `Parsed sermon v2: Smoke test sermon`
- Home tab renders body `하나님이 세상을 ...` (actual BibleDb text — verify non-empty)
- Sermon widget (if installed) updates to the new title/body

- [ ] **Step 3: Send a test QT push (topic `qt_events_test`)**

Payload:
```
date: 2026-04-17
title: Smoke test QT
series_title: 하나님의 손길
bible_references: [{"book":"에베소서","chapter":5,"verse_start":15,"verse_end":16}]
day_of_week: FRI
topic: qt_events_test
```

Expected:
- Logcat: `Parsed qt: Smoke test QT`
- "매일만나" tab renders series title + title + resolved body
- QT widget (if installed) shows new content

- [ ] **Step 4: Add QT widget from system picker**

System widget picker should expose "Daily QT (Card)" and "Daily QT (Banner)". Add one. Verify it renders real data.

- [ ] **Step 5: Inject a v1 message to confirm drop**

Send a push to `sermon_events` topic with legacy payload (containing `content` field).

Expected:
- No Logcat line from `MyFirebaseMessagingService` (completely silent drop)
- Crashlytics shows no new event
- App state unchanged

- [ ] **Step 6: Commit verification log (optional)**

If you captured a Logcat excerpt demonstrating tasks 1-5 above, save it as a PR comment rather than committing into the repo.

---

## Self-Review

After plan complete, verify:

1. **Spec coverage:**
   - Section 4 (Architecture): Tasks 2, 11, 12, 13 cover parallel pipelines.
   - Section 5 (Android Native): Tasks 2-13 map directly.
   - Section 6.1 (Types): Tasks 14, 15, 17.
   - Section 6.2 (Services): Tasks 16, 18.
   - Section 6.3 (Hooks): Tasks 19, 20.
   - Section 6.4 (Screens): Tasks 22, 23.
   - Section 7 (Testing): Tasks 2, 15, 17, 18, 21, 24.
   - Section 8 (Rollout): Task 25 (manual verification covers topic migration + v1 drop).

2. **Placeholders:** None. Every code step shows exact content.

3. **Type consistency check:** `QtDto` fields (`seriesTitle`/`dayOfWeek`) are used consistently in Tasks 4, 5, 6, 11. `QT` JS type (`series_title`/`day_of_week` snake_case per FCM) used consistently in Tasks 17, 18, 19, 20, 22. `onQtUpdated` signature `(qtData: string): Promise<boolean>` consistent in Tasks 12, 14, 20, 21.

4. **One known deferral:** Task 23 "route HomeScreen YouTube taps to sermon.video_url" — spec also notes `youtubeLinkEnabled` toggle should hide the link when off. That is deferred to post-Phase-1 polish as the settings toggle plumbing to HomeScreen/DailyMannaScreen is a separate integration not covered by any task. If required in this phase, add a follow-up task:
   - Task 26 (deferred): read `WidgetUpdateModule.getYoutubeLinkEnabled()` state in HomeScreen/DailyMannaScreen, hide both the header button and the bottom link when `false`.

---

## Commit strategy

Each task commits independently. Total: ~24 commits on `issue-54` branch. Use standard `[ISSUE-54] type: description` format. No `--amend`, no force pushes, no `--no-verify`.

## PR creation (at end)

After Task 25 completes green:

```bash
gh pr create --title "[ISSUE-54] feat: sermon/qt events v2 migration + QT widget" --body "..."
```

PR body should summarize: FCM v2 migration, QT pipeline, iOS explicit scope exclusion, link to spec doc.
