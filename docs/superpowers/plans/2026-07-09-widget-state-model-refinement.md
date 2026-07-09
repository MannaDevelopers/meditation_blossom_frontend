# 위젯 State 모델 재정의 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위젯이 "안내 문구" vs "에러 문구"를 사용자의 앱 실행 이력이 아니라 실제 `syncFromRemote()` 성공/실패로 판단하도록 재정의하고, `MainActivity`를 오버라이드 없는 순수 `ReactActivity`로 되돌린다.

**Architecture:** `WidgetContentState.NoDataYet`에서 `hasAppEverLaunched` 파라미터를 제거해 "한 번도 동기화 성공한 적 없음"만 의미하게 하고, `SermonRepositoryImpl`/`QtRepositoryImpl.syncFromRemote()`가 fetch 예외 시 `Error` 상태로, 성공+빈 컬렉션 시 `NoDataYet` 상태로 전환하며 두 경우 모두 `WidgetUpdateNotifier`를 호출하도록 재작성한다. 이제 이 신호를 쓰는 곳이 없어진 `AppLaunchState`(top-level 함수 + interface + Hilt 구현체)를 완전히 삭제하고, `MainActivity`의 `onCreate()`/`onStart()` 오버라이드를 제거한다.

**Tech Stack:** Kotlin, kotlinx.coroutines (`StateFlow`, `runCatching`), Hilt DI, JUnit4 + 수동 Fake 패턴(mocking 프레임워크 없음), Jetpack Glance.

## Global Constraints

- **Scope: Android only.** `android/app/...` 이외 파일은 건드리지 않는다. iOS/RN JS 쪽은 변경 대상이 아니다.
- 새 mocking 프레임워크를 도입하지 않는다 — 기존 수동 Fake 클래스 패턴(`FakeSermonPrefsSource` 등)을 그대로 따른다.
- 커밋 메시지 형식: `[ISSUE-NONE] type: 설명` (이 워크트리의 기존 커밋 컨벤션과 동일).
- 이 워크트리는 이미 `feature/widget-sync-redesign` 브랜치이며 원 아키텍처 재설계 플랜(Task 1~14, 커밋 `3a993a7`~`3e8f57e`)이 완료된 상태다. 새 작업은 이 브랜치 위에 이어서 커밋한다.
- **단계적 마이그레이션 허용:** 이 플랜은 서로 강하게 결합된 파일들(`WidgetContentState`가 양쪽 Repository에서 동시에 참조됨)을 다루므로, Task 1 완료 직후 `:app:compileDebugKotlin`이 `ui/widget/WidgetContentStateMapping.kt` 한 곳에서만 실패하는 것은 **의도된 중간 상태**다. `:app:assembleDebug`는 **Task 3(마지막 태스크)에서만** 반드시 성공해야 하는 최종 게이트다.
- Gradle 태스크 그래프 특성상 `:app:testDebugUnitTest`는 `:app:compileDebugKotlin`(메인 variant 전체)이 성공해야 실행된다. Task 1처럼 자신의 범위 밖 파일(`WidgetContentStateMapping.kt`)이 아직 깨져 있어 메인 variant가 컴파일되지 않는 상황에서 "내가 방금 작성한 테스트가 실제로 통과하는지"를 확인해야 할 때는: (1) 깨진 파일을 **임시로, 타입만 맞게** 고쳐 컴파일을 통과시키고 (2) 대상 테스트 클래스만 실행해 실제 GREEN 증거(JUnit XML)를 확보한 뒤 (3) `git checkout -- <임시로 고친 파일>`로 되돌리고 `git diff --stat`으로 되돌아갔음을 확인한 다음 (4) 최종 컴파일 체크와 커밋을 진행한다. 이 기법은 이 워크트리의 Task 4 구현자가 이미 사용해 검증된 방식이다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `widget/state/WidgetContentState.kt` | 위젯이 구독하는 4가지 state(`Loading`/`Data`/`NoDataYet`/`Error`) 정의 |
| `data/SermonRepositoryImpl.kt` / `data/QtRepositoryImpl.kt` | prefs 저장/로드 + Firestore 동기화 + state 갱신 + notify를 한 곳에서 담당 |
| `model/Sermon.kt` / `ui/widget/qt/QtWidgetUiModel.kt` | state를 실제 화면 문구로 변환하는 데이터 상수(`noData`/`errorSermon`/`error`) 보유 |
| `ui/widget/WidgetContentStateMapping.kt` | `WidgetContentState<T>` → 화면 모델(`Sermon`/`QtWidgetUiModel`) 매핑 함수 |
| `ui/widget/QtWidgetSmall.kt` / `QtWidgetLarge.kt` | Glance `provideGlance()` — `collectAsState()`로 위 매핑 함수를 소비 |
| `data/AppLaunchState.kt` | (삭제 대상) 더 이상 아무도 쓰지 않는 죽은 코드 |
| `di/AppModule.kt` | Hilt `@Binds` 모음 — `AppLaunchState` 바인딩 제거 |
| `MainActivity.kt` | RN 진입점 — 커스텀 오버라이드 전부 제거하고 순수 `ReactActivity`로 |

---

### Task 1: `WidgetContentState` 단순화 + Sermon/QT Repository·모델 계층 재작성 + 테스트

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/QtRepositoryImpl.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/model/Sermon.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt`
- Test: `android/app/src/test/java/app/mannadev/meditation/data/SermonRepositoryImplTest.kt`
- Test: `android/app/src/test/java/app/mannadev/meditation/data/QtRepositoryImplTest.kt`
- Test: `android/app/src/test/java/app/mannadev/meditation/model/SermonTest.kt`
- Test: `android/app/src/test/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModelTest.kt`

**Interfaces:**
- Consumes: `SermonPrefsSource`/`SermonRemoteSource`/`QtPrefsSource`/`QtRemoteSource`(변경 없음), `WidgetUpdateNotifier.notifySermonChanged()`/`notifyQtChanged()`(변경 없음, 둘 다 `suspend fun`)
- Produces: `WidgetContentState.NoDataYet`(파라미터 없는 `data object`), `Sermon.noData: Sermon`(파라미터 없는 `val`), `QtWidgetUiModel.noData: QtWidgetUiModel` / `QtWidgetUiModel.error: QtWidgetUiModel`(둘 다 파라미터 없는 `val`), `SermonRepositoryImpl`/`QtRepositoryImpl` 생성자에서 `appLaunchState` 파라미터 제거. 이 신규 시그니처들을 Task 2(`WidgetContentStateMapping.kt`)가 그대로 소비한다.

**주의 — 이 태스크가 끝나도 `ui/widget/WidgetContentStateMapping.kt`는 컴파일이 깨진 채로 남는다.** 그 파일은 Task 2에서 고친다(Global Constraints의 "단계적 마이그레이션 허용" 참고). 아래 Step 5에서 이걸 어떻게 우회해 실제 GREEN을 확인하는지 안내한다.

- [ ] **Step 1: 4개 테스트 파일을 새 시그니처로 전부 교체**

`android/app/src/test/java/app/mannadev/meditation/data/SermonRepositoryImplTest.kt` 전체를 아래 내용으로 교체:

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SermonRepositoryImplTest {

    private class FakeSermonPrefsSource : SermonPrefsSource {
        var stored: SermonDto? = null
        var throwOnRead: Throwable? = null
        override suspend fun getDisplaySermon(): SermonDto? {
            throwOnRead?.let { throw it }
            return stored
        }
        override suspend fun saveDisplaySermon(sermon: SermonDto) { stored = sermon }
        override suspend fun clearDisplaySermon() { stored = null }
    }

    private class FakeSermonRemoteSource(private var result: SermonDto?) : SermonRemoteSource {
        var throwOnFetch: Throwable? = null
        override suspend fun fetchLatestSermon(): SermonDto? {
            throwOnFetch?.let { throw it }
            return result
        }
    }

    private class FakeWidgetUpdateNotifier : WidgetUpdateNotifier {
        var sermonNotifyCount = 0
        var qtNotifyCount = 0
        override suspend fun notifySermonChanged() { sermonNotifyCount++ }
        override suspend fun notifyQtChanged() { qtNotifyCount++ }
    }

    private val sampleDto = SermonDto(
        date = "2026-07-06",
        title = "테스트 설교",
        content = "본문 : 로마서 1:1 1 바울은",
        dayOfWeek = "SUN",
        videoUrl = null,
    )

    @Test
    fun `save persists to prefs, updates state to Data, and notifies once`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.save(sampleDto)

        assertEquals(sampleDto, prefs.stored)
        val state = repository.sermonState.value
        assertTrue(state is WidgetContentState.Data)
        assertEquals("테스트 설교", (state as WidgetContentState.Data).value.title)
        assertEquals(1, notifier.sermonNotifyCount)
        assertEquals(0, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote saves fetched sermon when remote has data`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(sampleDto),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
        assertTrue(repository.sermonState.value is WidgetContentState.Data)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote sets NoDataYet and notifies when remote genuinely has no documents`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(null, prefs.stored)
        assertTrue(repository.sermonState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote sets Error and notifies, then rethrows, when remote fetch fails`() = runTest {
        val notifier = FakeWidgetUpdateNotifier()
        val remote = FakeSermonRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = SermonRepositoryImpl(
            prefsSource = FakeSermonPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = notifier,
        )

        val thrown = runCatching { repository.syncFromRemote() }.exceptionOrNull()

        assertEquals("network down", thrown?.message)
        assertTrue(repository.sermonState.value is WidgetContentState.Error)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `clear resets state to NoDataYet and notifies`() = runTest {
        val prefs = FakeSermonPrefsSource().apply { stored = sampleDto }
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        assertTrue(repository.sermonState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.sermonNotifyCount)
    }
}
```

`android/app/src/test/java/app/mannadev/meditation/data/QtRepositoryImplTest.kt` 전체를 아래 내용으로 교체:

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QtRepositoryImplTest {

    private class FakeQtPrefsSource : QtPrefsSource {
        var stored: QtDto? = null
        override suspend fun getDisplayQt(): QtDto? = stored
        override suspend fun saveDisplayQt(qt: QtDto) { stored = qt }
        override suspend fun clearDisplayQt() { stored = null }
    }

    private class FakeQtRemoteSource(private var result: QtDto?) : QtRemoteSource {
        var throwOnFetch: Throwable? = null
        override suspend fun fetchLatestQt(): QtDto? {
            throwOnFetch?.let { throw it }
            return result
        }
    }

    private class FakeWidgetUpdateNotifier : WidgetUpdateNotifier {
        var sermonNotifyCount = 0
        var qtNotifyCount = 0
        override suspend fun notifySermonChanged() { sermonNotifyCount++ }
        override suspend fun notifyQtChanged() { qtNotifyCount++ }
    }

    private val sampleDto = QtDto(
        date = "2026-07-09",
        title = "테스트 QT",
        seriesTitle = "",
        content = "본문 : 요한복음 1:1 1 태초에",
        dayOfWeek = "THU",
        videoUrl = null,
        meditationQuestions = listOf("질문1"),
    )

    @Test
    fun `save persists to prefs, updates state to Data, and notifies QT only`() = runTest {
        val prefs = FakeQtPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.save(sampleDto)

        assertEquals(sampleDto, prefs.stored)
        val state = repository.qtState.value
        assertTrue(state is WidgetContentState.Data)
        assertEquals(sampleDto, (state as WidgetContentState.Data).value)
        assertEquals(1, notifier.qtNotifyCount)
        assertEquals(0, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote saves fetched qt when remote has data`() = runTest {
        val prefs = FakeQtPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(sampleDto),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
        assertEquals(1, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote sets NoDataYet and notifies when remote genuinely has no documents`() = runTest {
        val prefs = FakeQtPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.syncFromRemote()

        assertEquals(null, prefs.stored)
        assertTrue(repository.qtState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.qtNotifyCount)
    }

    @Test
    fun `syncFromRemote sets Error and notifies, then rethrows, when remote fetch fails`() = runTest {
        val notifier = FakeWidgetUpdateNotifier()
        val remote = FakeQtRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = QtRepositoryImpl(
            prefsSource = FakeQtPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = notifier,
        )

        val thrown = runCatching { repository.syncFromRemote() }.exceptionOrNull()

        assertEquals("network down", thrown?.message)
        assertTrue(repository.qtState.value is WidgetContentState.Error)
        assertEquals(1, notifier.qtNotifyCount)
    }

    @Test
    fun `clear resets state to NoDataYet and notifies`() = runTest {
        val prefs = FakeQtPrefsSource().apply { stored = sampleDto }
        val notifier = FakeWidgetUpdateNotifier()
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = notifier,
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        assertTrue(repository.qtState.value is WidgetContentState.NoDataYet)
        assertEquals(1, notifier.qtNotifyCount)
    }
}
```

`android/app/src/test/java/app/mannadev/meditation/model/SermonTest.kt` 전체를 아래 내용으로 교체:

```kotlin
package app.mannadev.meditation.model

import app.mannadev.meditation.Constants
import org.junit.Assert.assertEquals
import org.junit.Test

class SermonTest {

    @Test fun `noData는 최초 실행 안내를 반환`() {
        val result = Sermon.noData
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, result.title)
        assertEquals(listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE), result.verses)
    }
}
```

`android/app/src/test/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModelTest.kt` 전체를 아래 내용으로 교체:

```kotlin
package app.mannadev.meditation.ui.widget.qt

import app.mannadev.meditation.Constants
import org.junit.Assert.assertEquals
import org.junit.Test

class QtWidgetUiModelTest {

    @Test fun `noData는 최초 실행 안내를 반환`() {
        val result = QtWidgetUiModel.noData
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, result.title)
        assertEquals(listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE), result.verses)
    }

    @Test fun `error는 새로고침 유도 안내를 반환`() {
        val result = QtWidgetUiModel.error
        assertEquals("QT를 불러오지 못했습니다", result.title)
        assertEquals(listOf(Constants.WIDGET_ERROR_GUIDE_MESSAGE), result.verses)
    }
}
```

- [ ] **Step 2: 테스트 파일만 컴파일 시도해서 실패 확인 (RED)**

Run: `cd android && ./gradlew :app:compileDebugUnitTestKotlin`
Expected: `BUILD FAILED`. 이유는 두 가지가 섞여 나온다 — (a) 프로덕션 코드가 아직 옛 시그니처라 테스트가 참조하는 새 API(`SermonRepositoryImpl(prefsSource=, remoteSource=, widgetUpdateNotifier=)`에 `appLaunchState` 없음, `QtWidgetUiModel.noData`/`.error` 등)가 없다는 unresolved reference 에러들. 이게 이 태스크의 RED다.

- [ ] **Step 3: `WidgetContentState.kt`를 파라미터 없는 `NoDataYet`으로 교체**

`android/app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt` 전체를 아래로 교체:

```kotlin
package app.mannadev.meditation.widget.state

sealed interface WidgetContentState<out T> {
    data object Loading : WidgetContentState<Nothing>
    data class Data<T>(val value: T) : WidgetContentState<T>
    data object NoDataYet : WidgetContentState<Nothing>
    data class Error(val throwable: Throwable) : WidgetContentState<Nothing>
}
```

- [ ] **Step 4: `SermonRepositoryImpl`/`QtRepositoryImpl`/`Sermon`/`QtWidgetUiModel` 재작성**

`android/app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt` 전체를 아래로 교체:

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonRepositoryImpl @Inject constructor(
    private val prefsSource: SermonPrefsSource,
    private val remoteSource: SermonRemoteSource,
    private val widgetUpdateNotifier: WidgetUpdateNotifier,
) : SermonRepository {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _sermonState =
        MutableStateFlow<WidgetContentState<Sermon>>(WidgetContentState.Loading)
    override val sermonState: StateFlow<WidgetContentState<Sermon>> = _sermonState.asStateFlow()

    init {
        scope.launch { loadFromPrefs() }
    }

    private suspend fun loadFromPrefs() {
        _sermonState.value = runCatching { prefsSource.getDisplaySermon() }
            .fold(
                onSuccess = { dto ->
                    if (dto != null) {
                        WidgetContentState.Data(Sermon.fromDto(dto))
                    } else {
                        WidgetContentState.NoDataYet
                    }
                },
                onFailure = { e -> WidgetContentState.Error(e) },
            )
    }

    override suspend fun save(dto: SermonDto) {
        prefsSource.saveDisplaySermon(dto)
        _sermonState.value = WidgetContentState.Data(Sermon.fromDto(dto))
        widgetUpdateNotifier.notifySermonChanged()
    }

    override suspend fun clear() {
        prefsSource.clearDisplaySermon()
        _sermonState.value = WidgetContentState.NoDataYet
        widgetUpdateNotifier.notifySermonChanged()
    }

    override suspend fun syncFromRemote() {
        val fetched = runCatching { remoteSource.fetchLatestSermon() }
            .onFailure { e ->
                _sermonState.value = WidgetContentState.Error(e)
                widgetUpdateNotifier.notifySermonChanged()
            }
            .getOrThrow()
        if (fetched != null) {
            save(fetched)
        } else {
            _sermonState.value = WidgetContentState.NoDataYet
            widgetUpdateNotifier.notifySermonChanged()
        }
    }
}
```

`android/app/src/main/java/app/mannadev/meditation/data/QtRepositoryImpl.kt` 전체를 아래로 교체:

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QtRepositoryImpl @Inject constructor(
    private val prefsSource: QtPrefsSource,
    private val remoteSource: QtRemoteSource,
    private val widgetUpdateNotifier: WidgetUpdateNotifier,
) : QtRepository {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _qtState =
        MutableStateFlow<WidgetContentState<QtDto>>(WidgetContentState.Loading)
    override val qtState: StateFlow<WidgetContentState<QtDto>> = _qtState.asStateFlow()

    init {
        scope.launch { loadFromPrefs() }
    }

    private suspend fun loadFromPrefs() {
        _qtState.value = runCatching { prefsSource.getDisplayQt() }
            .fold(
                onSuccess = { dto ->
                    if (dto != null) {
                        WidgetContentState.Data(dto)
                    } else {
                        WidgetContentState.NoDataYet
                    }
                },
                onFailure = { e -> WidgetContentState.Error(e) },
            )
    }

    override suspend fun save(dto: QtDto) {
        prefsSource.saveDisplayQt(dto)
        _qtState.value = WidgetContentState.Data(dto)
        widgetUpdateNotifier.notifyQtChanged()
    }

    override suspend fun clear() {
        prefsSource.clearDisplayQt()
        _qtState.value = WidgetContentState.NoDataYet
        widgetUpdateNotifier.notifyQtChanged()
    }

    override suspend fun syncFromRemote() {
        val fetched = runCatching { remoteSource.fetchLatestQt() }
            .onFailure { e ->
                _qtState.value = WidgetContentState.Error(e)
                widgetUpdateNotifier.notifyQtChanged()
            }
            .getOrThrow()
        if (fetched != null) {
            save(fetched)
        } else {
            _qtState.value = WidgetContentState.NoDataYet
            widgetUpdateNotifier.notifyQtChanged()
        }
    }
}
```

`android/app/src/main/java/app/mannadev/meditation/model/Sermon.kt` 전체를 아래로 교체:

```kotlin
package app.mannadev.meditation.model

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.Constants
import app.mannadev.meditation.dto.SermonDto
import timber.log.Timber

data class Sermon(
    val verses: List<String>, // 말씀 내용 (예: "또 비유로 말씀하시되...")
    val bookName: String, // 성경 책 이름 (예: "마태복음")
    val title: String, //설교 제목
    val videoUrl: String? = null,
) {
    companion object Companion {

        /** 데이터는 받았지만(parse 실패 등) 표시할 수 없을 때의 공통 에러 표시. */
        val errorSermon = Sermon(
            verses = listOf("내용을 불러올 수 없습니다.", Constants.WIDGET_ERROR_GUIDE_MESSAGE),
            title = "",
            bookName = ""
        )

        /** prefs/Firestore 어디서도 데이터를 아직 한 번도 동기화하지 못했을 때 사용하는 최초 실행 안내. */
        val noData: Sermon = Sermon(
            verses = listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE),
            title = Constants.WIDGET_FIRST_LAUNCH_TITLE,
            bookName = "",
        )

        fun fromDto(dto: SermonDto): Sermon =
            try {
                VerseParser.parse(dto)
            } catch (e: Exception) {
                Timber.e(e, "Sermon.fromDto failed for dto: $dto")
                CrashlyticsHelper.recordException(e, "Sermon.fromDto parsing failed")
                errorSermon
            }
    }
}
```

`android/app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt`의 companion object 내부 `fun error(hasAppEverLaunched: Boolean): QtWidgetUiModel = ...` 블록(현재 파일의 18~42번째 줄)을 아래로 교체(파일의 나머지 부분 — `fromDto`, `formatDateLabel`, `prefixQuestions` 등 — 은 그대로 유지):

```kotlin
    companion object {
        /** 아직 한 번도 QT를 동기화하지 못했을 때의 최초 실행 안내. */
        val noData: QtWidgetUiModel = QtWidgetUiModel(
            title = Constants.WIDGET_FIRST_LAUNCH_TITLE,
            dateLabel = "",
            reference = "",
            verses = listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE),
            questions = emptyList(),
            videoUrl = null,
        )

        /** 동기화를 시도했지만 실패했을 때의 새로고침 유도 안내. */
        val error: QtWidgetUiModel = QtWidgetUiModel(
            title = "QT를 불러오지 못했습니다",
            dateLabel = "",
            reference = "",
            verses = listOf(Constants.WIDGET_ERROR_GUIDE_MESSAGE),
            questions = emptyList(),
            videoUrl = null,
        )

        fun fromDto(dto: QtDto): QtWidgetUiModel {
            val titleMerged = if (dto.seriesTitle.isNotBlank())
                "${dto.title} / ${dto.seriesTitle}" else dto.title

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
                verses = if (dto.content.isBlank()) listOf("오늘 말씀은 책을 참고해주세요")
                         else parsed?.verses ?: listOf(dto.content),
                questions = dto.meditationQuestions,
                videoUrl = dto.videoUrl,
            )
        }
    }
```

- [ ] **Step 5: 대상 테스트만 실제로 통과하는지 확인 (GREEN, 임시 우회 필요)**

이 시점에 `./gradlew :app:testDebugUnitTest`를 그냥 돌리면 `ui/widget/WidgetContentStateMapping.kt`가 옛 API(`Sermon.noData(Boolean)`, `NoDataYet.hasAppEverLaunched`, `QtWidgetUiModel.error(Boolean)`)를 참조해 `:app:compileDebugKotlin`에서 실패하고, 테스트는 아예 실행되지 않는다. Global Constraints에 안내된 임시 우회를 사용한다:

1. `ui/widget/WidgetContentStateMapping.kt`를 아래 내용으로 **임시** 교체 (커밋하지 않음 — 타입만 맞추는 용도):

```kotlin
package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.widget.state.WidgetContentState

fun WidgetContentState<Sermon>.toDisplaySermon(): Sermon = when (this) {
    is WidgetContentState.Data -> value
    else -> Sermon.noData
}

fun WidgetContentState<QtDto>.toDisplayQtUiModel(): QtWidgetUiModel = when (this) {
    is WidgetContentState.Data -> QtWidgetUiModel.fromDto(value)
    else -> QtWidgetUiModel.noData
}
```

2. Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.data.SermonRepositoryImplTest" --tests "app.mannadev.meditation.data.QtRepositoryImplTest" --tests "app.mannadev.meditation.model.SermonTest" --tests "app.mannadev.meditation.ui.widget.qt.QtWidgetUiModelTest"`
   Expected: `BUILD SUCCESSFUL`. JUnit XML 리포트(`app/build/test-results/testDebugUnitTest/`)에서 4개 클래스, 총 15개 테스트(Sermon 5 + Qt 5 + SermonTest 1 + QtWidgetUiModelTest 2 — 실제 개수는 위 Step 1 코드 기준으로 세어 확인) 전부 `failures="0" errors="0"`인지 확인한다.
3. `git checkout -- android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt` 로 임시 교체를 되돌린다.
4. `git diff --stat -- android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt` 로 되돌아갔음을 확인한다(출력 없어야 함).

- [ ] **Step 6: 전체 모듈 컴파일 체크 — 예상되는 단일 실패 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: `BUILD FAILED`, 에러는 오직 `ui/widget/WidgetContentStateMapping.kt` 안에서만 발생(`Sermon.noData(hasAppEverLaunched = false)`를 함수처럼 호출하는 부분, `NoDataYet`에 존재하지 않는 `hasAppEverLaunched` 프로퍼티 접근하는 부분, `QtWidgetUiModel.error(hasAppEverLaunched = ...)`를 함수처럼 호출하는 부분 — 총 5개 에러 지점). 다른 파일에서 에러가 발생하면 이 태스크의 변경이 계획과 다르게 새어나간 것이므로 원인을 파악한다.

- [ ] **Step 7: 커밋**

```bash
cd android
git add app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt \
        app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt \
        app/src/main/java/app/mannadev/meditation/data/QtRepositoryImpl.kt \
        app/src/main/java/app/mannadev/meditation/model/Sermon.kt \
        app/src/main/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModel.kt \
        app/src/test/java/app/mannadev/meditation/data/SermonRepositoryImplTest.kt \
        app/src/test/java/app/mannadev/meditation/data/QtRepositoryImplTest.kt \
        app/src/test/java/app/mannadev/meditation/model/SermonTest.kt \
        app/src/test/java/app/mannadev/meditation/ui/widget/qt/QtWidgetUiModelTest.kt
git commit -m "[ISSUE-NONE] refactor: syncFromRemote 실패/빈컬렉션을 위젯 state에 반영

WidgetContentState.NoDataYet에서 hasAppEverLaunched 파라미터 제거 —
이제 '한 번도 동기화 성공한 적 없음'만 의미한다. SermonRepositoryImpl/
QtRepositoryImpl.syncFromRemote()가 fetch 예외 시 Error 세팅+notify
후 rethrow, 성공+빈 컬렉션 시 NoDataYet 세팅+notify하도록 재작성.
Sermon.noData/QtWidgetUiModel.noData·error를 파라미터 없는 상수로 단순화.

ui/widget/WidgetContentStateMapping.kt는 다음 태스크에서 이 새 시그니처에
맞춰 고친다(단계적 마이그레이션, 현재 :app:compileDebugKotlin은 그
파일에서만 실패하는 것이 예상된 상태)."
git status --short
```

`git status --short` 결과에 위 9개 파일 외에 다른 변경이 남아있지 않은지(특히 Step 5의 임시 `WidgetContentStateMapping.kt` 교체가 완전히 되돌려졌는지) 확인한다.

---

### Task 2: `WidgetContentStateMapping` 재작성 + 죽은 import 정리 + 매핑 테스트

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt`
- Test: `android/app/src/test/java/app/mannadev/meditation/ui/widget/WidgetContentStateMappingTest.kt`

**Interfaces:**
- Consumes: Task 1의 `Sermon.noData`/`Sermon.errorSermon`/`QtWidgetUiModel.noData`/`QtWidgetUiModel.error`/`QtWidgetUiModel.fromDto()`, `WidgetContentState.Loading`/`Data`/`NoDataYet`/`Error`
- Produces: `WidgetContentState<Sermon>.toDisplaySermon(): Sermon`, `WidgetContentState<QtDto>.toDisplayQtUiModel(): QtWidgetUiModel` — 시그니처는 기존과 동일(확장 함수 이름·타입 변경 없음), Task 3에서 그대로 재사용 가능하고 `QtWidgetSmall.kt`/`QtWidgetLarge.kt`의 `provideGlance()`가 이미 이 함수들을 `collectAsState()`로 소비 중(변경 없음)

- [ ] **Step 1: 실패하는 매핑 테스트 작성 (RED)**

`android/app/src/test/java/app/mannadev/meditation/ui/widget/WidgetContentStateMappingTest.kt` 새로 생성:

```kotlin
package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.Constants
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState
import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetContentStateMappingTest {

    private val sampleSermon = Sermon(verses = listOf("본문"), bookName = "마태복음", title = "제목")

    @Test fun `Sermon Data는 그대로 보여준다`() {
        val result = WidgetContentState.Data(sampleSermon).toDisplaySermon()
        assertEquals(sampleSermon, result)
    }

    @Test fun `Sermon Loading과 NoDataYet은 최초 실행 안내를 보여준다`() {
        assertEquals(Sermon.noData, WidgetContentState.Loading.toDisplaySermon())
        assertEquals(Sermon.noData, WidgetContentState.NoDataYet.toDisplaySermon())
    }

    @Test fun `Sermon Error는 새로고침 유도 문구를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplaySermon()
        assertEquals(Sermon.errorSermon, result)
    }

    private val sampleQt = QtDto(
        date = "2026-07-09",
        title = "제목",
        seriesTitle = "",
        content = "본문",
        dayOfWeek = "THU",
        videoUrl = null,
        meditationQuestions = emptyList(),
    )

    @Test fun `Qt Data는 fromDto로 변환해서 보여준다`() {
        val result = WidgetContentState.Data(sampleQt).toDisplayQtUiModel()
        assertEquals("제목", result.title)
    }

    @Test fun `Qt Loading과 NoDataYet은 최초 실행 안내를 보여준다`() {
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, WidgetContentState.Loading.toDisplayQtUiModel().title)
        assertEquals(Constants.WIDGET_FIRST_LAUNCH_TITLE, WidgetContentState.NoDataYet.toDisplayQtUiModel().title)
    }

    @Test fun `Qt Error는 새로고침 유도 문구를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplayQtUiModel()
        assertEquals("QT를 불러오지 못했습니다", result.title)
    }
}
```

- [ ] **Step 2: 컴파일 실패 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: `BUILD FAILED`. Task 1 종료 시점부터 이미 깨져 있던 `ui/widget/WidgetContentStateMapping.kt`의 동일한 5개 에러(`Sermon.noData(...)`를 함수처럼 호출, 없는 `hasAppEverLaunched` 프로퍼티 접근, `QtWidgetUiModel.error(...)`를 함수처럼 호출)가 그대로 나온다. 이게 이 태스크의 RED다.

- [ ] **Step 3: `WidgetContentStateMapping.kt` 재작성**

`android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt` 전체를 아래로 교체:

```kotlin
package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel
import app.mannadev.meditation.widget.state.WidgetContentState

/**
 * 어떤 state든 기존 Content Composable로 그릴 수 있는 [Sermon]으로 변환한다.
 * NoDataYet/Error/Loading도 항상 clickAction이 붙은 정상 Composable 경로를 타므로,
 * 과거 errorUiLayout(네이티브 XML, 클릭 불가)로 빠지는 경로 자체가 없어진다.
 */
fun WidgetContentState<Sermon>.toDisplaySermon(): Sermon = when (this) {
    is WidgetContentState.Data -> value
    is WidgetContentState.Loading, is WidgetContentState.NoDataYet -> Sermon.noData
    is WidgetContentState.Error -> Sermon.errorSermon
}

/**
 * 어떤 state든 기존 Content Composable로 그릴 수 있는 [QtWidgetUiModel]로 변환한다.
 * Sermon과 동일하게 NoDataYet/Error/Loading도 항상 clickAction이 붙은 정상 Composable
 * 경로를 타므로, 과거 errorUiLayout(네이티브 XML, 클릭 불가)로 빠지는 경로 자체가 없어진다.
 */
fun WidgetContentState<QtDto>.toDisplayQtUiModel(): QtWidgetUiModel = when (this) {
    is WidgetContentState.Data -> QtWidgetUiModel.fromDto(value)
    is WidgetContentState.Loading, is WidgetContentState.NoDataYet -> QtWidgetUiModel.noData
    is WidgetContentState.Error -> QtWidgetUiModel.error
}
```

- [ ] **Step 4: `QtWidgetSmall.kt`/`QtWidgetLarge.kt`의 죽은 import 제거**

`android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt`에서 아래 줄을 삭제:

```kotlin
import app.mannadev.meditation.data.hasAppEverLaunched
```

`android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt`에서 동일한 줄을 삭제.

- [ ] **Step 5: 전체 컴파일 + 전체 테스트 그린 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: `BUILD SUCCESSFUL` (Task 1부터 이어지던 단계적 마이그레이션이 여기서 끝난다).

Run: `cd android && ./gradlew :app:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL`, 전체 유닛 테스트 스위트(Task 1의 4개 클래스 + 이 태스크의 `WidgetContentStateMappingTest` + 기존의 나머지 모든 테스트) 전부 통과.

- [ ] **Step 6: 커밋**

```bash
cd android
git add app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt \
        app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt \
        app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt \
        app/src/test/java/app/mannadev/meditation/ui/widget/WidgetContentStateMappingTest.kt
git commit -m "[ISSUE-NONE] refactor: WidgetContentStateMapping을 새 NoDataYet 시그니처에 맞춰 재작성

Loading/NoDataYet을 같은 분기로 병합해 Sermon.noData/QtWidgetUiModel.noData로
매핑. QtWidgetSmall/Large의 죽은 hasAppEverLaunched import 제거.
이 커밋으로 Task 1부터의 단계적 마이그레이션이 끝나고 컴파일이 다시 완전히
깨끗해진다."
git status --short
```

---

### Task 3: `AppLaunchState` 삭제 + `MainActivity` 단순화

**Files:**
- Delete: `android/app/src/main/java/app/mannadev/meditation/data/AppLaunchState.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/MainActivity.kt`

**Interfaces:**
- Consumes: 없음 — 이 태스크는 순수 삭제/단순화이며 다른 태스크가 만든 새 API를 소비하지 않는다.
- Produces: 없음 — 이후 태스크가 없으므로 소비처가 없다. 이 태스크가 이 플랜의 마지막 태스크이며 `:app:assembleDebug` 최종 게이트를 통과해야 한다.

- [ ] **Step 1: `AppLaunchState.kt` 삭제**

```bash
cd android
git rm app/src/main/java/app/mannadev/meditation/data/AppLaunchState.kt
```

- [ ] **Step 2: `AppModule.kt`에서 `AppLaunchState` 바인딩 제거**

`android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt`에서 import 2줄 삭제:

```kotlin
import app.mannadev.meditation.data.AppLaunchState
import app.mannadev.meditation.data.AppLaunchStateImpl
```

그리고 아래 `@Binds` 블록을 삭제:

```kotlin
    @Binds
    @Singleton
    abstract fun bindAppLaunchState(impl: AppLaunchStateImpl): AppLaunchState

```

(삭제 후 `RepositoryModule`에는 `bindSermonRepository`/`bindSermonPrefsSource`/`bindSermonRemoteSource`/`bindWidgetUpdateNotifier`/`bindQtRepository`/`bindQtPrefsSource`/`bindQtRemoteSource` 7개 `@Binds`만 남는다.)

- [ ] **Step 3: `MainActivity.kt` 단순화**

`android/app/src/main/java/app/mannadev/meditation/MainActivity.kt` 전체를 아래로 교체:

```kotlin
package app.mannadev.meditation

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "meditation_blossom"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(
            this,
            mainComponentName,
            DefaultNewArchitectureEntryPoint.fabricEnabled
        )
}
```

- [ ] **Step 4: 전체 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: 전체 유닛 테스트 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL`, 전체 스위트 통과, `AppLaunchState`/`FakeAppLaunchState`를 참조하는 테스트가 하나도 남아있지 않음(Task 1에서 이미 전부 제거됨).

- [ ] **Step 6: 최종 게이트 — `assembleDebug`**

Run: `cd android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`. 이 플랜의 유일한 `assembleDebug` 게이트이며, 반드시 통과해야 커밋한다.

- [ ] **Step 7: 커밋**

```bash
cd android
git add app/src/main/java/app/mannadev/meditation/di/AppModule.kt \
        app/src/main/java/app/mannadev/meditation/MainActivity.kt
git commit -m "[ISSUE-NONE] refactor: AppLaunchState 삭제, MainActivity를 순수 ReactActivity로 단순화

hasAppEverLaunched 신호를 쓰는 곳이 Task 1~2로 전부 없어져 AppLaunchState.kt
(top-level 함수 + interface + Hilt 구현체)와 AppModule.kt의 관련 바인딩이
죽은 코드가 됨 — 삭제. MainActivity.onCreate()의 markAppLaunched()/
enqueueWidgetInitialSync() 호출과 onStart() 오버라이드 전체를 제거 —
JS의 HomeScreen.init() fetchFromServer()와 WidgetInitialSyncWorker/
WidgetPeriodicSyncWorker의 자체 재시도가 이미 해당 시나리오를 커버하고,
collectAsState()가 save()/clear()/syncFromRemote()의 모든 상태 변화에서
반응형으로 갱신되므로 수동 notify 호출도 더 이상 필요 없음."
git status --short
```

`git status --short`가 완전히 비어 있는지(모든 변경이 3개 태스크 커밋에 정확히 나뉘어 반영됐는지) 확인한다.

---

## Self-Review

**Spec coverage:** Decision 1(NoDataYet 파라미터 제거)·2(Error 세팅)·3(NoDataYet 세팅)·4(notify 호출)는 Task 1에서, Decision 5(비영속화)는 Task 1의 구현이 SharedPreferences를 건드리지 않는 것으로 자동 충족, Decision 6(AppLaunchState 제거)·7(MainActivity 단순화)은 Task 3에서, Decision 8(죽은 import)은 Task 2에서 각각 다룬다. Data Model 섹션의 state 전이표 8개 행 전부 Task 1의 `syncFromRemote()`/`save()`/`clear()`/`loadFromPrefs()` 구현에 반영됨. UI 매핑 코드 샘플은 Task 2에서 그대로 구현. File Change Checklist 14개 항목 전부 Task 1~3에 매핑됨(WidgetContentState/SermonRepositoryImpl/QtRepositoryImpl/Sermon/QtWidgetUiModel/SermonRepositoryImplTest/QtRepositoryImplTest/SermonTest/QtWidgetUiModelTest → Task 1, WidgetContentStateMapping/QtWidgetSmall/QtWidgetLarge → Task 2, AppLaunchState/AppModule/MainActivity → Task 3). Testing Strategy의 "mocking 프레임워크 신규 도입 없음" 요구사항도 전 태스크에서 기존 수동 Fake 패턴만 사용해 충족.

**Placeholder scan:** "TBD"/"적절히"/"필요시" 류 문구 없음. 모든 코드 블록은 실제 전체 파일 내용(또는 명시적으로 범위를 좁힌 블록 교체)이다.

**Type consistency:** `WidgetContentState.NoDataYet`(Task 1에서 `data object`로 선언) → Task 2의 `WidgetContentStateMapping.kt`에서 `is WidgetContentState.NoDataYet`로 프로퍼티 접근 없이 매칭 → Task 3에서는 참조하지 않음, 일관됨. `Sermon.noData`/`QtWidgetUiModel.noData`/`QtWidgetUiModel.error`(Task 1에서 파라미터 없는 `val`로 선언) → Task 2에서 함수 호출이 아닌 프로퍼티 참조로 정확히 소비. `SermonRepositoryImpl`/`QtRepositoryImpl` 생성자 시그니처(Task 1에서 `appLaunchState` 제거) → Task 1의 테스트 파일들이 이미 새 시그니처로 작성됨, Task 2/3는 이 생성자를 직접 호출하지 않으므로 영향 없음. Task 2가 "생산"하는 `toDisplaySermon()`/`toDisplayQtUiModel()` 확장 함수 시그니처는 기존과 동일(이름·파라미터·반환 타입 불변)하므로 `QtWidgetSmall.kt`/`QtWidgetLarge.kt`의 기존 `collectAsState()` 소비 코드는 변경 없이 그대로 컴파일된다.
