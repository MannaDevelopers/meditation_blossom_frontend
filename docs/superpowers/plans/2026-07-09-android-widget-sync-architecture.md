# Android 위젯 데이터 동기화 아키텍처 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위젯이 "빈 상태를 렌더링해두고 나중에 updateAll()로 탈출을 시도"하는 대신, Repository가 노출하는 `StateFlow<WidgetContentState<T>>`를 `collectAsState()`로 구독하도록 재설계한다. 모든 writer(FCM/RN 브릿지/WorkManager)는 `Repository.save()` 한 곳으로만 쓰고, 위젯 갱신 트리거도 그 안 한 곳(`WidgetUpdateNotifier`)에서만 일어난다.

**Architecture:** Sermon/QT 각각 `Repository`(`StateFlow` 노출 + `save()`/`clear()`/`syncFromRemote()`) → `WidgetUpdateNotifier`(`updateAll()` 단일 호출 지점) → Glance 위젯(`provideGlance()`에서 `collectAsState()`로 구독, 모든 state를 기존 Content Composable로 렌더링해 클릭 액션이 항상 살아있게 함). `WidgetInitialSyncWorker`(1회, 설치 시)와 `WidgetPeriodicSyncWorker`(1일 1회, 신규)는 둘 다 `syncFromRemote()`만 부르고, 실패 시 `Result.retry()`로 WorkManager backoff에 위임한다.

**Tech Stack:** Kotlin, Hilt, Jetpack Glance(`androidx.glance.appwidget`), WorkManager, kotlinx.coroutines(`StateFlow`), kotlinx.serialization, JUnit4 + 수동 Fake(mockk 없음, `kotlinx-coroutines-test`/`androidx.work:work-testing` 신규 추가).

## Global Constraints

- Scope: Android only. iOS(WidgetKit)와 RN JS 쪽 fetch 로직(`useSermonData`, `HomeScreen.init()`)은 건드리지 않는다.
- `WidgetUpdateModule`의 JS 인터페이스 시그니처(`onSermonUpdated`/`onQtUpdated`/`onClear`/`resolveBibleReferences`/`getYoutubeLinkEnabled`/`setYoutubeLinkEnabled`)는 그대로 유지한다.
- `updatePeriodMillis`(30분, 4개 위젯 XML)는 보조 수단으로 유지하고 건드리지 않는다.
- 새 mocking 프레임워크(mockk 등) 도입 금지 — 기존 `FakeBibleDb`(`android/app/src/test/java/app/mannadev/meditation/bible/BibleRepositoryTest.kt`) 스타일의 수동 Fake 패턴을 따른다.
- 커밋 메시지 컨벤션: `[ISSUE-NONE] type: 설명` (이 작업에 연결된 GitHub 이슈 없음).
- 각 태스크는 `./gradlew :app:testDebugUnitTest`(신규/변경된 테스트만이라도)와 `./gradlew :app:assembleDebug`로 컴파일 확인 후 커밋한다.

---

## Task 1: 테스트 의존성 추가

**Files:**
- Modify: `android/app/build.gradle.kts:155-166`

**Interfaces:**
- Produces: `kotlinx-coroutines-test`(`runTest`), `androidx.work:work-testing`(`TestListenableWorkerBuilder`) — 이후 모든 태스크의 테스트가 사용.

- [ ] **Step 1: `build.gradle.kts`의 테스트 의존성 블록에 추가**

`android/app/build.gradle.kts:161` (`testImplementation(libs.junit)` 바로 아래)에 추가:

```kotlin
    testImplementation(libs.junit)
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("androidx.work:work-testing:2.9.1")
```

- [ ] **Step 2: 동기화 및 컴파일 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.bible.BibleRepositoryTest" 2>&1 | tail -20`
Expected: 기존 테스트가 그대로 통과(새 의존성이 기존 빌드를 깨지 않았는지 확인). `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add android/app/build.gradle.kts
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] chore: 위젯 재설계용 코루틴/WorkManager 테스트 의존성 추가

kotlinx-coroutines-test(Flow/StateFlow 테스트)와 androidx.work:work-testing
(CoroutineWorker 테스트)을 추가. 기존 mockk 없는 수동 Fake 패턴은 유지.
EOF
)"
```

---

## Task 2: `WidgetContentState` + `AppLaunchState` 추상화 + Prefs/Remote 인터페이스 추출(Sermon)

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/SermonPrefsSource.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/SermonRemoteSource.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/SermonPrefsDataSource.kt` (interface 구현 추가)
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt` (interface 구현 추가 + `Source.SERVER`)
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/AppLaunchState.kt` (interface + Hilt 구현 추가, 기존 top-level 함수는 유지)

**Interfaces:**
- Produces:
  - `sealed interface WidgetContentState<out T>` — `Loading`, `Data<T>(value: T)`, `NoDataYet(hasAppEverLaunched: Boolean)`, `Error(throwable: Throwable)`
  - `interface SermonPrefsSource { suspend fun getDisplaySermon(): SermonDto?; suspend fun saveDisplaySermon(sermon: SermonDto); suspend fun clearDisplaySermon() }`
  - `interface SermonRemoteSource { suspend fun fetchLatestSermon(): SermonDto? }`
  - `interface AppLaunchState { fun hasEverLaunched(): Boolean }`

이 태스크는 순수 리팩터(동작 변경 없음, `Source.SERVER` 전환만 예외)라 기존 자동 테스트가 없다. Task 4의 `SermonRepositoryImplTest`가 이 인터페이스들을 Fake로 교체해서 간접 검증한다.

- [ ] **Step 1: `WidgetContentState.kt` 작성**

```kotlin
package app.mannadev.meditation.widget.state

sealed interface WidgetContentState<out T> {
    data object Loading : WidgetContentState<Nothing>
    data class Data<T>(val value: T) : WidgetContentState<T>
    data class NoDataYet(val hasAppEverLaunched: Boolean) : WidgetContentState<Nothing>
    data class Error(val throwable: Throwable) : WidgetContentState<Nothing>
}
```

- [ ] **Step 2: `AppLaunchState.kt`에 인터페이스 + Hilt 구현 추가**

`android/app/src/main/java/app/mannadev/meditation/data/AppLaunchState.kt` 전체를 다음으로 교체(기존 `markAppLaunched`/`hasAppEverLaunched` top-level 함수는 그대로 유지 — `MainActivity.onCreate`가 계속 씀):

```kotlin
package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private const val PREFS_NAME = "app_launch_prefs"
private const val KEY_HAS_LAUNCHED = "has_launched"

/** MainActivity가 최초로 실행됐을 때(사용자가 직접 앱을 연 시점) 한 번 기록한다. */
fun markAppLaunched(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
        putBoolean(KEY_HAS_LAUNCHED, true)
    }
}

/**
 * 위젯이 데이터를 못 가져왔을 때, "메인 앱을 한 번도 연 적 없어서 아직 활성화 전인 상태"와
 * "앱은 열었지만 어떤 이유로 데이터를 못 가져온 진짜 에러 상태"를 구분하기 위한 신호.
 * 전자는 안내 문구를, 후자는 새로고침 유도 문구를 보여줘야 한다.
 */
fun hasAppEverLaunched(context: Context): Boolean =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_HAS_LAUNCHED, false)

/** Repository가 실제 Context 없이 단위 테스트 가능하도록 감싼 인터페이스. */
interface AppLaunchState {
    fun hasEverLaunched(): Boolean
}

@Singleton
class AppLaunchStateImpl @Inject constructor(
    @ApplicationContext private val context: Context,
) : AppLaunchState {
    override fun hasEverLaunched(): Boolean = hasAppEverLaunched(context)
}
```

- [ ] **Step 3: `SermonPrefsSource.kt` 인터페이스 작성**

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto

interface SermonPrefsSource {
    suspend fun getDisplaySermon(): SermonDto?
    suspend fun saveDisplaySermon(sermon: SermonDto)
    suspend fun clearDisplaySermon()
}
```

- [ ] **Step 4: `SermonPrefsDataSource`가 위 인터페이스를 구현하도록 수정**

`android/app/src/main/java/app/mannadev/meditation/data/SermonPrefsDataSource.kt` 전체를 다음으로 교체(로직은 동일, `: SermonPrefsSource` + `override` 추가):

```kotlin
package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit
import app.mannadev.meditation.dto.SermonDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonPrefsDataSource @Inject constructor(
    @ApplicationContext context: Context
) : SermonPrefsSource {

    companion object {
        private const val PREFS_NAME = "sermon_prefs"
        private const val KEY_DISPLAY_SERMON_JSON = "display_sermon_json"

        private val json = Json {
            ignoreUnknownKeys = true // JSON에 정의되지 않은 키를 무시
        }
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override suspend fun getDisplaySermon(): SermonDto? = withContext(Dispatchers.IO) {
        val jsonString = prefs.getString(KEY_DISPLAY_SERMON_JSON, null)
        if (jsonString.isNullOrBlank()) return@withContext null
        try {
            json.decodeFromString<SermonDto>(jsonString)
        } catch (e: Exception) {
            throw RuntimeException(
                "Error decoding sermon JSON: $jsonString",
                e
            )
        }
    }

    override suspend fun saveDisplaySermon(sermon: SermonDto) = withContext(Dispatchers.IO) {
        prefs.edit {
            putString(KEY_DISPLAY_SERMON_JSON, json.encodeToString(sermon))
        }
    }

    override suspend fun clearDisplaySermon() = withContext(Dispatchers.IO) {
        prefs.edit {
            remove(KEY_DISPLAY_SERMON_JSON)
        }
    }
}
```

- [ ] **Step 5: `SermonRemoteSource.kt` 인터페이스 작성**

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto

interface SermonRemoteSource {
    suspend fun fetchLatestSermon(): SermonDto?
}
```

- [ ] **Step 6: `SermonFirestoreDataSource`가 위 인터페이스를 구현하고 `Source.SERVER`를 쓰도록 수정**

`android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt` 전체를 다음으로 교체:

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

class FirestoreFetchException(message: String, cause: Throwable? = null) : Exception(message, cause)

@Singleton
class SermonFirestoreDataSource @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val bibleReferenceResolver: BibleReferenceResolver,
) : SermonRemoteSource {
    /** 위젯이 prefs 없이 단독 설치됐을 때를 위한 fallback. Firestore에서 최신 설교 1건을 직접 조회한다. */
    override suspend fun fetchLatestSermon(): SermonDto? = withContext(Dispatchers.IO) {
        val snapshot = try {
            firestore.collection("sermons")
                .orderBy("date", Query.Direction.DESCENDING)
                .limit(1)
                .get(Source.SERVER)
                .await()
        } catch (e: Exception) {
            throw FirestoreFetchException("Error fetching sermon from Firestore", e)
        }
        if (snapshot.isEmpty) {
            CrashlyticsHelper.recordException(
                FirestoreFetchException("sermons collection returned no documents"),
                "SermonFirestoreDataSource: empty snapshot",
            )
            return@withContext null
        }
        val data = snapshot.documents.first().data ?: return@withContext null

        val date = data["date"] as? String ?: run {
            CrashlyticsHelper.recordException(
                FirestoreFetchException("sermon doc missing/invalid 'date' field. keys=${data.keys}"),
                "SermonFirestoreDataSource: date field missing",
            )
            return@withContext null
        }
        val title = data["title"] as? String ?: run {
            CrashlyticsHelper.recordException(
                FirestoreFetchException("sermon doc missing/invalid 'title' field. keys=${data.keys}"),
                "SermonFirestoreDataSource: title field missing",
            )
            return@withContext null
        }

        SermonDto(
            date = date,
            title = title,
            content = resolveFirestoreContent(bibleReferenceResolver, data),
            dayOfWeek = data["day_of_week"] as? String ?: "",
            videoUrl = (data["video_url"] as? String)?.takeIf { it.isNotBlank() },
        )
    }
}
```

(`resolveFirestoreContent`는 같은 패키지의 `android/app/src/main/java/app/mannadev/meditation/data/FirestoreBibleReferences.kt`에 `internal fun`으로 정의돼 있다 — 같은 패키지라 import 없이 그대로 컴파일된다.)

- [ ] **Step 7: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -40`
Expected: `BUILD SUCCESSFUL`. (아직 `SermonRepositoryImpl`을 안 고쳤으므로 그쪽에서 타입 에러가 안 나는지 확인 — `SermonPrefsDataSource`/`SermonFirestoreDataSource`는 구체 타입으로 계속 주입받고 있으므로 이 시점엔 에러가 없어야 한다.)

- [ ] **Step 8: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/widget/state/WidgetContentState.kt \
        android/app/src/main/java/app/mannadev/meditation/data/AppLaunchState.kt \
        android/app/src/main/java/app/mannadev/meditation/data/SermonPrefsSource.kt \
        android/app/src/main/java/app/mannadev/meditation/data/SermonRemoteSource.kt \
        android/app/src/main/java/app/mannadev/meditation/data/SermonPrefsDataSource.kt \
        android/app/src/main/java/app/mannadev/meditation/data/SermonFirestoreDataSource.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: WidgetContentState 도입 + Sermon 데이터소스 인터페이스 추출

Repository가 노출할 sealed state 타입과, 테스트에서 Fake로 교체 가능하도록
SermonPrefsDataSource/SermonFirestoreDataSource를 인터페이스 뒤로 추출.
Firestore 조회를 Source.SERVER로 명시해 서버 미도달을 진짜 예외로 전환
(기존엔 조용한 빈 성공이라 재시도가 안 걸렸음).
EOF
)"
```

---

## Task 3: `WidgetUpdateNotifier` 도입

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/widget/WidgetUpdateNotifier.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/widget/WidgetUpdateNotifierImpl.kt`

**Interfaces:**
- Consumes: `VerseWidgetLarge`, `VerseWidgetSmall`, `QtWidgetLarge`, `QtWidgetSmall`(기존 `androidx.glance.appwidget.GlanceAppWidget` 서브클래스, `.updateAll(context)` 확장함수 존재).
- Produces: `interface WidgetUpdateNotifier { suspend fun notifySermonChanged(); suspend fun notifyQtChanged() }` — Task 4/5의 Repository가 이걸 주입받아 씀.

- [ ] **Step 1: `WidgetUpdateNotifier.kt` 인터페이스 작성**

```kotlin
package app.mannadev.meditation.widget

interface WidgetUpdateNotifier {
    suspend fun notifySermonChanged()
    suspend fun notifyQtChanged()
}
```

- [ ] **Step 2: `WidgetUpdateNotifierImpl.kt` 작성**

```kotlin
package app.mannadev.meditation.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.ui.widget.QtWidgetLarge
import app.mannadev.meditation.ui.widget.QtWidgetSmall
import app.mannadev.meditation.ui.widget.VerseWidgetLarge
import app.mannadev.meditation.ui.widget.VerseWidgetSmall
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WidgetUpdateNotifierImpl @Inject constructor(
    @ApplicationContext private val context: Context,
) : WidgetUpdateNotifier {

    override suspend fun notifySermonChanged() {
        runCatching {
            VerseWidgetLarge().updateAll(context)
            VerseWidgetSmall().updateAll(context)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetUpdateNotifier: failed to update sermon widgets")
        }
    }

    override suspend fun notifyQtChanged() {
        runCatching {
            QtWidgetLarge().updateAll(context)
            QtWidgetSmall().updateAll(context)
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "WidgetUpdateNotifier: failed to update QT widgets")
        }
    }
}
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -20`
Expected: `BUILD SUCCESSFUL` (아직 Hilt 바인딩을 안 걸었으므로 이 클래스는 아무도 안 쓰지만, 그 자체로는 컴파일돼야 한다).

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/widget/WidgetUpdateNotifier.kt \
        android/app/src/main/java/app/mannadev/meditation/widget/WidgetUpdateNotifierImpl.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] feat: WidgetUpdateNotifier 도입 — updateAll() 호출 단일 지점

지금까지 6곳(FCM 서비스/RN 브릿지/Worker)에서 각자 updateAll()을 중복
호출하던 걸, Repository.save() 내부에서만 부르는 단일 지점으로 통합하기
위한 인터페이스. Hilt 바인딩은 다음 태스크에서 연결.
EOF
)"
```

---

## Task 4: `SermonRepository`를 `StateFlow` 기반으로 재작성 + 테스트

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/domain/repository/SermonRepository.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt` (신규 `@Binds` 추가)
- Create: `android/app/src/test/java/app/mannadev/meditation/data/SermonRepositoryImplTest.kt`

**Interfaces:**
- Consumes: `SermonPrefsSource`(Task 2), `SermonRemoteSource`(Task 2), `AppLaunchState`(Task 2), `WidgetUpdateNotifier`(Task 3).
- Produces: `SermonRepository.sermonState: StateFlow<WidgetContentState<Sermon>>`, `suspend fun save(dto: SermonDto)`, `suspend fun clear()`, `suspend fun syncFromRemote()` — Task 6/7/9/11이 이걸 씀.

- [ ] **Step 1: 실패하는 테스트부터 작성 — `SermonRepositoryImplTest.kt`**

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

    private class FakeAppLaunchState(private val launched: Boolean) : AppLaunchState {
        override fun hasEverLaunched(): Boolean = launched
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
            appLaunchState = FakeAppLaunchState(true),
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
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
        assertEquals(1, notifier.sermonNotifyCount)
    }

    @Test
    fun `syncFromRemote does nothing when remote genuinely has no documents`() = runTest {
        val prefs = FakeSermonPrefsSource()
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()

        assertEquals(null, prefs.stored)
        assertEquals(0, notifier.sermonNotifyCount)
    }

    @Test(expected = RuntimeException::class)
    fun `syncFromRemote propagates remote failure so caller can retry`() = runTest {
        val remote = FakeSermonRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = SermonRepositoryImpl(
            prefsSource = FakeSermonPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()
    }

    @Test
    fun `clear resets state to NoDataYet carrying launch flag, and notifies`() = runTest {
        val prefs = FakeSermonPrefsSource().apply { stored = sampleDto }
        val notifier = FakeWidgetUpdateNotifier()
        val repository = SermonRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeSermonRemoteSource(null),
            widgetUpdateNotifier = notifier,
            appLaunchState = FakeAppLaunchState(true),
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        val state = repository.sermonState.value
        assertTrue(state is WidgetContentState.NoDataYet)
        assertTrue((state as WidgetContentState.NoDataYet).hasAppEverLaunched)
        assertEquals(1, notifier.sermonNotifyCount)
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인(컴파일 에러여도 OK — 아직 `SermonRepositoryImpl` 시그니처가 안 맞음)**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.data.SermonRepositoryImplTest" 2>&1 | tail -40`
Expected: 컴파일 실패(`SermonRepositoryImpl`의 생성자 파라미터가 아직 `SermonPrefsSource`/`SermonRemoteSource`/`AppLaunchState`를 안 받음, `save`/`syncFromRemote`/`sermonState` 없음).

- [ ] **Step 3: `SermonRepository` 인터페이스 수정**

`android/app/src/main/java/app/mannadev/meditation/domain/repository/SermonRepository.kt` 전체 교체:

```kotlin
package app.mannadev.meditation.domain.repository

import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.flow.StateFlow

interface SermonRepository {
    val sermonState: StateFlow<WidgetContentState<Sermon>>
    suspend fun save(dto: SermonDto)
    suspend fun clear()
    /** Firestore에서 최신 설교를 조회해 있으면 저장한다. 조회 실패 시 예외를 던진다(호출자가 재시도 여부 결정). */
    suspend fun syncFromRemote()
}
```

- [ ] **Step 4: `SermonRepositoryImpl` 재작성**

`android/app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt` 전체 교체:

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
    private val appLaunchState: AppLaunchState,
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
                        WidgetContentState.NoDataYet(appLaunchState.hasEverLaunched())
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
        _sermonState.value = WidgetContentState.NoDataYet(appLaunchState.hasEverLaunched())
        widgetUpdateNotifier.notifySermonChanged()
    }

    override suspend fun syncFromRemote() {
        val fetched = remoteSource.fetchLatestSermon()
        if (fetched != null) {
            save(fetched)
        }
    }
}
```

- [ ] **Step 5: `AppModule.kt`에 신규 `@Binds` 추가**

`android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt` 전체 교체:

```kotlin
@file:Suppress("unused")

package app.mannadev.meditation.di

import androidx.annotation.Keep
import app.mannadev.meditation.data.AppLaunchState
import app.mannadev.meditation.data.AppLaunchStateImpl
import app.mannadev.meditation.data.SermonFirestoreDataSource
import app.mannadev.meditation.data.SermonPrefsDataSource
import app.mannadev.meditation.data.SermonPrefsSource
import app.mannadev.meditation.data.SermonRemoteSource
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.WidgetUpdateNotifierImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Keep
@Module
@InstallIn(SingletonComponent::class) // Application-level dependencies
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindSermonRepository(
        sermonRepositoryImpl: SermonRepositoryImpl
    ): SermonRepository

    @Binds
    @Singleton
    abstract fun bindSermonPrefsSource(impl: SermonPrefsDataSource): SermonPrefsSource

    @Binds
    @Singleton
    abstract fun bindSermonRemoteSource(impl: SermonFirestoreDataSource): SermonRemoteSource

    @Binds
    @Singleton
    abstract fun bindAppLaunchState(impl: AppLaunchStateImpl): AppLaunchState

    @Binds
    @Singleton
    abstract fun bindWidgetUpdateNotifier(impl: WidgetUpdateNotifierImpl): WidgetUpdateNotifier
}
```

(주의: 원래 `AppModule.kt`엔 `EditableSermonDataSource`/`SermonDataSource`/`@Qualifier` 관련 import가 있었지만 실제 클래스 본문에서 안 쓰이고 있었다 — 이 교체본에서 정리됨. 만약 컴파일 에러가 나면 `git show HEAD:android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt`로 원본을 확인해서 실제 쓰이는 import를 놓치지 않았는지 대조한다.)

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.data.SermonRepositoryImplTest" 2>&1 | tail -40`
Expected: 5개 테스트 모두 `PASSED`. `BUILD SUCCESSFUL`.

- [ ] **Step 7: 전체 컴파일 확인(QT/Worker 등 아직 안 고친 곳이 깨지는지 확인용)**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -60`
Expected: `GetDisplaySermonUseCase`, `WidgetInitialSyncWorker`, `WidgetUpdateModule` 등에서 `getDisplaySermon()`/`getDisplaySermonUseCase()` 관련 타입 에러가 날 수 있음 — 이건 정상이며 Task 6~9에서 고친다. 이 시점에 에러 목록을 기록해두고 넘어간다.

- [ ] **Step 8: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/domain/repository/SermonRepository.kt \
        android/app/src/main/java/app/mannadev/meditation/data/SermonRepositoryImpl.kt \
        android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt \
        android/app/src/test/java/app/mannadev/meditation/data/SermonRepositoryImplTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: SermonRepository를 StateFlow 기반으로 재작성

getDisplaySermon(): Sermon? 단발성 조회를 sermonState: StateFlow<WidgetContentState<Sermon>>로
교체. save()/clear()가 prefs 저장+state 갱신+WidgetUpdateNotifier 호출을 한 곳에서
처리. syncFromRemote()는 Worker가 재시도 판단에 쓸 수 있도록 실패 시 예외를 그대로
전파한다. 이 시점에서 QT/Worker/브릿지 쪽은 아직 안 고쳐서 컴파일 에러가 남아있음
(다음 태스크들에서 해결).
EOF
)"
```

---

## Task 5: `QtRepository` 신설 + Prefs/Remote 인터페이스 추출(QT) + 테스트

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/data/QtPrefsSource.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/QtRemoteSource.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/domain/repository/QtRepository.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/data/QtRepositoryImpl.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/QtPrefsDataSource.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/data/QtFirestoreDataSource.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt`
- Create: `android/app/src/test/java/app/mannadev/meditation/data/QtRepositoryImplTest.kt`

**Interfaces:**
- Consumes: `AppLaunchState`, `WidgetUpdateNotifier`(Task 2, 3).
- Produces: `QtRepository.qtState: StateFlow<WidgetContentState<QtDto>>`, `suspend fun save(dto: QtDto)`, `suspend fun clear()`, `suspend fun syncFromRemote()` — Task 6/7/9/12가 씀. (Sermon과 달리 QT는 도메인 모델이 따로 없어 `QtDto`를 그대로 state에 담는다 — 기존 코드 관례와 동일.)

- [ ] **Step 1: 실패하는 테스트 작성 — `QtRepositoryImplTest.kt`**

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

    private class FakeAppLaunchState(private val launched: Boolean) : AppLaunchState {
        override fun hasEverLaunched(): Boolean = launched
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
            appLaunchState = FakeAppLaunchState(true),
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
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(sampleDto),
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()

        assertEquals(sampleDto, prefs.stored)
    }

    @Test(expected = RuntimeException::class)
    fun `syncFromRemote propagates remote failure`() = runTest {
        val remote = FakeQtRemoteSource(null).apply {
            throwOnFetch = RuntimeException("network down")
        }
        val repository = QtRepositoryImpl(
            prefsSource = FakeQtPrefsSource(),
            remoteSource = remote,
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.syncFromRemote()
    }

    @Test
    fun `clear resets state to NoDataYet`() = runTest {
        val prefs = FakeQtPrefsSource().apply { stored = sampleDto }
        val repository = QtRepositoryImpl(
            prefsSource = prefs,
            remoteSource = FakeQtRemoteSource(null),
            widgetUpdateNotifier = FakeWidgetUpdateNotifier(),
            appLaunchState = FakeAppLaunchState(false),
        )

        repository.clear()

        assertEquals(null, prefs.stored)
        assertTrue(repository.qtState.value is WidgetContentState.NoDataYet)
    }
}
```

- [ ] **Step 2: 테스트 실행해서 컴파일 실패 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.data.QtRepositoryImplTest" 2>&1 | tail -30`
Expected: 컴파일 실패(`QtPrefsSource`/`QtRemoteSource`/`QtRepositoryImpl` 미존재).

- [ ] **Step 3: `QtPrefsSource.kt` 작성**

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto

interface QtPrefsSource {
    suspend fun getDisplayQt(): QtDto?
    suspend fun saveDisplayQt(qt: QtDto)
    suspend fun clearDisplayQt()
}
```

- [ ] **Step 4: `QtPrefsDataSource`가 위 인터페이스를 구현하도록 수정**

`android/app/src/main/java/app/mannadev/meditation/data/QtPrefsDataSource.kt` 전체 교체:

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
) : QtPrefsSource {
    companion object {
        private const val PREFS_NAME = "qt_prefs"
        private const val KEY_DISPLAY_QT_JSON = "display_qt_json"

        private val json = Json { ignoreUnknownKeys = true }
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override suspend fun getDisplayQt(): QtDto? = withContext(Dispatchers.IO) {
        val jsonString = prefs.getString(KEY_DISPLAY_QT_JSON, null)
        if (jsonString.isNullOrBlank()) return@withContext null
        try {
            json.decodeFromString<QtDto>(jsonString)
        } catch (e: Exception) {
            throw RuntimeException("Error decoding QT JSON: $jsonString", e)
        }
    }

    override suspend fun saveDisplayQt(qt: QtDto) = withContext(Dispatchers.IO) {
        prefs.edit {
            putString(KEY_DISPLAY_QT_JSON, json.encodeToString(qt))
        }
    }

    override suspend fun clearDisplayQt() = withContext(Dispatchers.IO) {
        prefs.edit { remove(KEY_DISPLAY_QT_JSON) }
    }
}
```

- [ ] **Step 5: `QtRemoteSource.kt` 작성**

```kotlin
package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto

interface QtRemoteSource {
    suspend fun fetchLatestQt(): QtDto?
}
```

- [ ] **Step 6: `QtFirestoreDataSource`가 위 인터페이스를 구현하고 `Source.SERVER`를 쓰도록 수정**

먼저 현재 파일을 확인한다: `cat android/app/src/main/java/app/mannadev/meditation/data/QtFirestoreDataSource.kt`. `SermonFirestoreDataSource`(Task 2 Step 6)와 동일한 구조일 것이다 — `class QtFirestoreDataSource ... { suspend fun fetchLatestQt(): QtDto? { ... firestore.collection("qt")...get() ... } }` 패턴. 다음 변경을 적용한다:
1. `class QtFirestoreDataSource @Inject constructor(...)` 뒤에 `: QtRemoteSource` 추가
2. `fetchLatestQt` 앞에 `override` 추가
3. `.get()` → `.get(Source.SERVER)`
4. `import com.google.firebase.firestore.Source` 추가

- [ ] **Step 7: `QtRepository.kt` 인터페이스 작성**

```kotlin
package app.mannadev.meditation.domain.repository

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.widget.state.WidgetContentState
import kotlinx.coroutines.flow.StateFlow

interface QtRepository {
    val qtState: StateFlow<WidgetContentState<QtDto>>
    suspend fun save(dto: QtDto)
    suspend fun clear()
    suspend fun syncFromRemote()
}
```

- [ ] **Step 8: `QtRepositoryImpl.kt` 작성**

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
    private val appLaunchState: AppLaunchState,
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
                        WidgetContentState.NoDataYet(appLaunchState.hasEverLaunched())
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
        _qtState.value = WidgetContentState.NoDataYet(appLaunchState.hasEverLaunched())
        widgetUpdateNotifier.notifyQtChanged()
    }

    override suspend fun syncFromRemote() {
        val fetched = remoteSource.fetchLatestQt()
        if (fetched != null) {
            save(fetched)
        }
    }
}
```

- [ ] **Step 9: `AppModule.kt`에 QT `@Binds` 추가**

Task 4 Step 5에서 만든 `RepositoryModule`에 다음 4개를 추가(import도 함께):

```kotlin
    @Binds
    @Singleton
    abstract fun bindQtRepository(qtRepositoryImpl: QtRepositoryImpl): QtRepository

    @Binds
    @Singleton
    abstract fun bindQtPrefsSource(impl: QtPrefsDataSource): QtPrefsSource

    @Binds
    @Singleton
    abstract fun bindQtRemoteSource(impl: QtFirestoreDataSource): QtRemoteSource
```

추가 import: `app.mannadev.meditation.data.QtFirestoreDataSource`, `app.mannadev.meditation.data.QtPrefsDataSource`, `app.mannadev.meditation.data.QtPrefsSource`, `app.mannadev.meditation.data.QtRemoteSource`, `app.mannadev.meditation.data.QtRepositoryImpl`, `app.mannadev.meditation.domain.repository.QtRepository`.

- [ ] **Step 10: 테스트 통과 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.data.QtRepositoryImplTest" --tests "app.mannadev.meditation.data.SermonRepositoryImplTest" 2>&1 | tail -40`
Expected: 9개 테스트(Sermon 5 + Qt 4) 모두 `PASSED`.

- [ ] **Step 11: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/data/QtPrefsSource.kt \
        android/app/src/main/java/app/mannadev/meditation/data/QtRemoteSource.kt \
        android/app/src/main/java/app/mannadev/meditation/domain/repository/QtRepository.kt \
        android/app/src/main/java/app/mannadev/meditation/data/QtRepositoryImpl.kt \
        android/app/src/main/java/app/mannadev/meditation/data/QtPrefsDataSource.kt \
        android/app/src/main/java/app/mannadev/meditation/data/QtFirestoreDataSource.kt \
        android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt \
        android/app/src/test/java/app/mannadev/meditation/data/QtRepositoryImplTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] feat: QtRepository 신설 — Sermon과 동일한 StateFlow 구조로 통일

지금까지 GetDisplayQtUseCase에 prefs+Firestore 로직이 직접 박혀있던 구조
불일치를 Sermon과 동일한 Repository 패턴으로 통일. Source.SERVER도 함께 적용.
EOF
)"
```

---

## Task 6: `WidgetUpdateModule` 브릿지가 Repository를 직접 쓰도록 변경

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/rnmodule/WidgetUpdateModule.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/RNModuleDependencies.kt`

**Interfaces:**
- Consumes: `SermonRepository.save()`(Task 4), `QtRepository.save()`(Task 5).
- Produces: `WidgetUpdateModule`의 `@ReactMethod` 시그니처는 변경 없음(JS 쪽 영향 없음).

이 태스크는 기존 JS↔Native 브릿지 계약을 유지하면서 내부 구현만 바꾸는 것이라, 이 리포에 RN 브릿지 모듈에 대한 JVM 단위 테스트 관례가 없다(모두 실기기/에뮬레이터로 검증). 컴파일 확인 + Task 15의 수동 회귀로 검증한다.

- [ ] **Step 1: `RNModuleDependencies.kt`에서 UseCase 노출을 Repository로 교체**

`android/app/src/main/java/app/mannadev/meditation/di/RNModuleDependencies.kt` 전체 교체:

```kotlin
package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.data.WidgetPrefsDataSource
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.model.BibleReferenceResolver
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface RNModuleDependencies {
    fun sermonRepository(): SermonRepository
    fun qtRepository(): QtRepository
    fun getBibleReferenceResolver(): BibleReferenceResolver
    fun getWidgetPrefs(): WidgetPrefsDataSource
}

fun getRNModuleDependencies(context: Context): RNModuleDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        RNModuleDependencies::class.java
    )
}
```

- [ ] **Step 2: `WidgetUpdateModule.kt`의 `onSermonUpdated`/`onQtUpdated`/`onClear` 수정**

`android/app/src/main/java/app/mannadev/meditation/rnmodule/WidgetUpdateModule.kt`에서 다음 메서드들을 교체한다(파일 전체가 아니라 이 3개 메서드 + `updateWidgets`/`updateQtWidgets` 헬퍼만):

```kotlin
    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onClear(promise: Promise) {
        moduleScope.launch {
            val result = runCatching {
                log.d("Clearing sermon widget preference...")
                moduleDependencies.sermonRepository().clear()
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error clear Widget Preferences: ${e.message}",
                    tag = TAG
                )
            }

            result
                .onSuccess { promise.resolve(null) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "Error in WidgetUpdateModule: ${e.message}",
                        tag = TAG
                    )
                    promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
                }
        }
    }

    @Suppress("unused")
    @Keep
    @ReactMethod
    fun onSermonUpdated(sermonData: String, promise: Promise) {
        moduleScope.launch {
            val saveSermonToPrefs = runCatching {
                log.d("Saving sermon to Widget Preference...")
                val resolver = moduleDependencies.getBibleReferenceResolver()
                val sermonDto = json.decodeFromString<SermonDto>(sermonData)
                log.d("SermonDto: $sermonDto")
                val resolvedDto = runCatching { resolver.resolveDto(sermonDto) }
                    .onFailure { e ->
                        CrashlyticsHelper.recordException(
                            e,
                            "BibleReferenceResolver failed in RN bridge: ${sermonDto.content}",
                            tag = TAG,
                        )
                    }
                    .getOrNull() ?: return@runCatching
                moduleDependencies.sermonRepository().save(resolvedDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.RN_MODULE)
                log.d("Sermon saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(
                    e,
                    "Error saving sermon data: ${e.message}",
                    tag = TAG
                )
            }

            saveSermonToPrefs
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    CrashlyticsHelper.recordException(
                        e,
                        "Error in WidgetUpdateModule: ${e.message}",
                        tag = TAG
                    )
                    promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
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
                val qtDto = json.decodeFromString<QtDto>(qtData)
                moduleDependencies.qtRepository().save(qtDto)
                log.d("QT saved to prefs successfully")
            }.onFailure { e ->
                CrashlyticsHelper.recordException(e, "Error saving QT data: ${e.message}", tag = TAG)
            }

            saveResult
                .onSuccess { promise.resolve(true) }
                .onFailure { e ->
                    promise.reject("QT_UPDATE_ERROR", e.message, e)
                }
        }
    }
```

(`updateWidgets()`/`updateQtWidgets()` private suspend 헬퍼 2개는 이제 아무도 안 부르므로 파일에서 삭제한다. `enqueueWidgetInitialSync` import도 이 파일에서 더 이상 안 쓰면 삭제한다.)

- [ ] **Step 3: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -60`
Expected: `WidgetUpdateModule.kt` 관련 에러는 사라지고, `MyFirebaseMessagingService.kt`/`WidgetInitialSyncWorker.kt`(아직 옛 UseCase를 쓰는 곳)에서만 에러가 남아야 한다.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/rnmodule/WidgetUpdateModule.kt \
        android/app/src/main/java/app/mannadev/meditation/di/RNModuleDependencies.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: WidgetUpdateModule이 Repository.save()/clear()를 직접 호출

JS onSermonUpdated/onQtUpdated/onClear 시그니처는 그대로. 내부에서 updateAll()
+ enqueueWidgetInitialSync()를 직접 부르던 코드를 제거 — 이제 Repository.save()
안에서 WidgetUpdateNotifier가 한 번만 부른다.
EOF
)"
```

---

## Task 7: `MyFirebaseMessagingService`가 Repository를 직접 쓰도록 변경

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt`

**Interfaces:**
- Consumes: `SermonRepository.save()`(Task 4), `QtRepository.save()`(Task 5).

- [ ] **Step 1: `consumeSermonEvent`/`consumeQtEvent`와 필드 주입 수정**

`android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt`에서:

1. 필드 선언을 교체:
```kotlin
    @Inject lateinit var sermonRepository: SermonRepository
    @Inject lateinit var qtRepository: QtRepository
    @Inject lateinit var asyncStorage: AsyncStorage
    @Inject lateinit var bibleReferenceResolver: BibleReferenceResolver
```

2. import 교체: `app.mannadev.meditation.domain.usecase.SaveDisplayQtUseCase`/`SaveDisplaySermonUseCase` 제거, 대신 `app.mannadev.meditation.domain.repository.QtRepository`/`app.mannadev.meditation.domain.repository.SermonRepository` 추가. `androidx.glance.appwidget.updateAll`, `app.mannadev.meditation.ui.widget.VerseWidgetLarge/Small/QtWidgetLarge/Small`, `app.mannadev.meditation.widget.enqueueWidgetInitialSync` import는 더 이상 필요 없으므로 제거.

3. `consumeSermonEvent`의 저장+위젯갱신 블록 2개(원래 `runCatching { saveDisplaySermonUseCase(...) }`와 `runCatching { VerseWidgetLarge()...updateAll... }`)를 하나로 교체:

```kotlin
        runCatching {
            withContext(NonCancellable) {
                sermonRepository.save(sermonDto)
                AnalyticsHelper.logUpdateSermonEvent(SermonEventSource.FCM_TOPIC)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save sermon v2: $sermonDto")
        }
```

4. `consumeQtEvent`도 동일하게:

```kotlin
        runCatching {
            withContext(NonCancellable) {
                qtRepository.save(qtDto)
            }
        }.onFailure { e ->
            CrashlyticsHelper.recordException(e, "Failed to save qt: $qtDto")
        }
```

(각 함수에서 AsyncStorage/LocalBroadcastManager 관련 마지막 `runCatching` 블록은 그대로 둔다 — RN 쪽 `useFCMListener`가 여전히 이 브로드캐스트를 구독하므로 건드리지 않는다.)

- [ ] **Step 2: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -60`
Expected: `MyFirebaseMessagingService.kt` 에러 사라짐. `WidgetInitialSyncWorker.kt` 관련 에러만 남아야 함.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/service/MyFirebaseMessagingService.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: MyFirebaseMessagingService가 Repository.save()를 직접 호출

FCM 수신 시 updateAll() + enqueueWidgetInitialSync()를 직접 부르던 코드 제거.
저장 로직은 Repository.save() 하나로 위임.
EOF
)"
```

---

## Task 8: 옛 UseCase 5개 삭제 + `WidgetDependencies`/`UseCaseModule` 정리

**Files:**
- Delete: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplaySermonUseCase.kt`
- Delete: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplayQtUseCase.kt`
- Delete: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/SaveDisplaySermonUseCase.kt`
- Delete: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/SaveDisplayQtUseCase.kt`
- Delete: `android/app/src/main/java/app/mannadev/meditation/domain/usecase/ClearWidgetPreferenceUseCase.kt`
- Delete: `android/app/src/main/java/app/mannadev/meditation/di/UseCaseModule.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt`

**Interfaces:**
- Consumes: `SermonRepository`, `QtRepository`(Task 4, 5) — `WidgetDependencies`가 이걸 노출.
- Produces: `WidgetDependencies.sermonRepository()`/`.qtRepository()` — Task 9(Worker)와 Task 11/12(위젯 Composable)가 씀.

주의: `ClearQtPreferenceUseCase.kt`는 삭제하지 않는다 — 코드베이스 어디서도 호출되지 않는 기존 dead code라(이번 세션에 grep으로 확인됨), 이 리팩터와 무관하다. 그대로 두거나, 별도 이슈로 처리한다.

- [ ] **Step 1: 5개 파일 삭제**

```bash
git rm android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplaySermonUseCase.kt
git rm android/app/src/main/java/app/mannadev/meditation/domain/usecase/GetDisplayQtUseCase.kt
git rm android/app/src/main/java/app/mannadev/meditation/domain/usecase/SaveDisplaySermonUseCase.kt
git rm android/app/src/main/java/app/mannadev/meditation/domain/usecase/SaveDisplayQtUseCase.kt
git rm android/app/src/main/java/app/mannadev/meditation/domain/usecase/ClearWidgetPreferenceUseCase.kt
git rm android/app/src/main/java/app/mannadev/meditation/di/UseCaseModule.kt
```

- [ ] **Step 2: `WidgetDependencies.kt` 수정**

`android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt` 전체 교체:

```kotlin
package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.data.WidgetPrefsDataSource
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetDependencies {
    fun sermonRepository(): SermonRepository
    fun qtRepository(): QtRepository
    fun getWidgetPrefs(): WidgetPrefsDataSource
}

fun getWidgetDependencies(context: Context): WidgetDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        WidgetDependencies::class.java
    )
}
```

- [ ] **Step 3: 전체 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -80`
Expected: `WidgetInitialSyncWorker.kt`(`getDisplaySermonUseCase()`/`getDisplayQtUseCase()` 호출)와 4개 위젯 파일(`getDisplaySermonUseCase`/`getDisplayQtUseCase` 호출)에서만 에러가 남아야 한다. 이건 Task 9, 11, 12에서 고친다.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: 위임만 하던 UseCase 5개 제거, WidgetDependencies가 Repository 직접 노출

GetDisplaySermonUseCase/GetDisplayQtUseCase/SaveDisplaySermonUseCase/
SaveDisplayQtUseCase/ClearWidgetPreferenceUseCase는 Repository로 그대로
위임만 하던 계층이라 제거. UseCaseModule.kt도 함께 삭제(제공하던 유일한
바인딩이 사라짐). Worker/위젯 Composable 쪽은 다음 태스크에서 새 타입에 맞춘다.
EOF
)"
```

---

## Task 9: `WidgetInitialSyncWorker` 재작성 + 테스트

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/widget/WidgetInitialSyncWorker.kt`
- Create: `android/app/src/test/java/app/mannadev/meditation/widget/WidgetInitialSyncWorkerTest.kt`

**Interfaces:**
- Consumes: `getWidgetDependencies(context).sermonRepository()`/`.qtRepository()`(Task 8), `SermonRepository.syncFromRemote()`/`QtRepository.syncFromRemote()`(Task 4, 5).
- Produces: `enqueueWidgetInitialSync(context: Context)` — 시그니처 변경 없음, 기존 호출부(4개 Receiver의 `onEnabled`, `MainActivity.onCreate`) 그대로 유지.

`androidx.work:work-testing`의 `TestListenableWorkerBuilder`는 Hilt 주입을 자동으로 해주지 않으므로, 이 테스트는 `getWidgetDependencies()`를 우회할 수 없다 — 대신 워커의 핵심 로직(예외 시 `Result.retry()`, 성공 시 `Result.success()`)을 별도의 순수 함수로 뽑아서 테스트한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```kotlin
package app.mannadev.meditation.widget

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetInitialSyncWorkerTest {

    @Test
    fun `runSync returns success when both syncs succeed`() = runTest {
        val result = runWidgetSync(
            syncSermon = { },
            syncQt = { },
        )
        assertTrue(result.isSuccess)
    }

    @Test
    fun `runSync returns failure when sermon sync throws`() = runTest {
        val result = runWidgetSync(
            syncSermon = { throw RuntimeException("network down") },
            syncQt = { },
        )
        assertTrue(result.isFailure)
    }

    @Test
    fun `runSync returns failure when qt sync throws`() = runTest {
        val result = runWidgetSync(
            syncSermon = { },
            syncQt = { throw RuntimeException("network down") },
        )
        assertTrue(result.isFailure)
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.widget.WidgetInitialSyncWorkerTest" 2>&1 | tail -30`
Expected: 컴파일 실패(`runWidgetSync` 미존재).

- [ ] **Step 3: `WidgetInitialSyncWorker.kt` 재작성 — 재사용 가능한 `runWidgetSync` 헬퍼 포함**

`android/app/src/main/java/app/mannadev/meditation/widget/WidgetInitialSyncWorker.kt` 전체 교체:

```kotlin
package app.mannadev.meditation.widget

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import java.util.concurrent.TimeUnit

/**
 * Sermon/QT 원격 동기화를 실행하고 성공/실패를 [Result]로 감싼다.
 * [WidgetInitialSyncWorker]/[WidgetPeriodicSyncWorker] 양쪽에서 공유하며,
 * 순수 람다만 받으므로 Hilt 없이도 단위 테스트 가능하다.
 */
suspend fun runWidgetSync(
    syncSermon: suspend () -> Unit,
    syncQt: suspend () -> Unit,
): kotlin.Result<Unit> = runCatching {
    syncSermon()
    syncQt()
}

class WidgetInitialSyncWorker(
    context: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "widget_initial_sync"
    }

    override suspend fun doWork(): Result {
        val dependencies = getWidgetDependencies(applicationContext)
        val result = runWidgetSync(
            syncSermon = { dependencies.sermonRepository().syncFromRemote() },
            syncQt = { dependencies.qtRepository().syncFromRemote() },
        )
        return result.fold(
            onSuccess = { Result.success() },
            onFailure = { e ->
                CrashlyticsHelper.recordException(e, "WidgetInitialSyncWorker failed")
                Result.retry()
            },
        )
    }
}

fun enqueueWidgetInitialSync(context: Context) {
    val request = OneTimeWorkRequestBuilder<WidgetInitialSyncWorker>()
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build(),
        )
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()

    WorkManager.getInstance(context)
        .enqueueUniqueWork(
            WidgetInitialSyncWorker.WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request,
        )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "app.mannadev.meditation.widget.WidgetInitialSyncWorkerTest" 2>&1 | tail -30`
Expected: 3개 테스트 `PASSED`.

- [ ] **Step 5: 전체 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -60`
Expected: 4개 위젯 Composable 파일(`VerseWidgetSmall.kt` 등)에서만 에러 남음(Task 11/12에서 해결).

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/widget/WidgetInitialSyncWorker.kt \
        android/app/src/test/java/app/mannadev/meditation/widget/WidgetInitialSyncWorkerTest.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: WidgetInitialSyncWorker가 syncFromRemote()+Result.retry() 사용

0초/3초/8초 수동 redraw 재시도 루프 제거. 실패 시 Result.retry()를 반환해
기존 BackoffPolicy.EXPONENTIAL(30초)에 재시도를 위임한다(이전엔 빈 fetch에도
Result.success()를 반환해 재시도가 아예 안 걸리는 결함이 있었음). 핵심 로직을
runWidgetSync()로 뽑아 Hilt 없이 단위 테스트 가능하게 함 — WidgetPeriodicSyncWorker와
공유.
EOF
)"
```

---

## Task 10: `WidgetPeriodicSyncWorker` 신설 + 등록

**Files:**
- Create: `android/app/src/main/java/app/mannadev/meditation/widget/WidgetPeriodicSyncWorker.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/MainApplication.kt`

**Interfaces:**
- Consumes: `runWidgetSync()`(Task 9), `getWidgetDependencies()`(Task 8).
- Produces: `fun enqueueWidgetPeriodicSync(context: Context)` — `MainApplication.onCreate()`가 앱 프로세스 시작마다 1회 호출(멱등, `ExistingPeriodicWorkPolicy.KEEP`).

- [ ] **Step 1: `WidgetPeriodicSyncWorker.kt` 작성**

```kotlin
package app.mannadev.meditation.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.di.getWidgetDependencies
import java.util.concurrent.TimeUnit

/**
 * FCM push가 누락됐을 때를 대비한 하루 1회 안전망. 설교(주 1회)/QT(일 1회) 갱신
 * 주기상 실시간성이 필요 없으므로 배터리 영향을 최소화하기 위해 1일 간격으로 둔다.
 */
class WidgetPeriodicSyncWorker(
    context: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val WORK_NAME = "widget_periodic_sync"
    }

    override suspend fun doWork(): Result {
        val dependencies = getWidgetDependencies(applicationContext)
        val result = runWidgetSync(
            syncSermon = { dependencies.sermonRepository().syncFromRemote() },
            syncQt = { dependencies.qtRepository().syncFromRemote() },
        )
        return result.fold(
            onSuccess = { Result.success() },
            onFailure = { e ->
                CrashlyticsHelper.recordException(e, "WidgetPeriodicSyncWorker failed")
                Result.retry()
            },
        )
    }
}

fun enqueueWidgetPeriodicSync(context: Context) {
    val request = PeriodicWorkRequestBuilder<WidgetPeriodicSyncWorker>(1, TimeUnit.DAYS)
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build(),
        )
        .build()

    WorkManager.getInstance(context)
        .enqueueUniquePeriodicWork(
            WidgetPeriodicSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
}
```

- [ ] **Step 2: `MainApplication.onCreate()`에 등록 호출 추가**

`android/app/src/main/java/app/mannadev/meditation/MainApplication.kt:53` (`// 기존 토픽 구독 해제` 주석 바로 위)에 추가:

```kotlin
        app.mannadev.meditation.widget.enqueueWidgetPeriodicSync(this)

```

(또는 파일 상단 import 블록에 `import app.mannadev.meditation.widget.enqueueWidgetPeriodicSync`를 추가하고 `onCreate()` 안에서 `enqueueWidgetPeriodicSync(this)`로 짧게 호출해도 된다 — 기존 파일의 import 스타일을 따른다.)

- [ ] **Step 3: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -60`
Expected: 4개 위젯 Composable 파일에서만 에러 남음(변화 없음, Task 11/12 대기 중).

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/widget/WidgetPeriodicSyncWorker.kt \
        android/app/src/main/java/app/mannadev/meditation/MainApplication.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] feat: WidgetPeriodicSyncWorker로 1일 1회 안전망 추가

FCM push 누락 시 최대 하루 안에 자체 복구되도록 PeriodicWorkRequest(1day)를
MainApplication.onCreate()에서 등록. WidgetInitialSyncWorker와 동일한
runWidgetSync() 헬퍼를 공유해 로직 중복 없음.
EOF
)"
```

---

## Task 11: Sermon 위젯 2개를 `collectAsState` 패턴으로 전환

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLarge.kt`
- Create: `android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt`

**Interfaces:**
- Consumes: `getWidgetDependencies(context).sermonRepository()`(Task 8), `SermonRepository.sermonState: StateFlow<WidgetContentState<Sermon>>`(Task 4).
- Produces: 없음(최종 UI 계층).

기존 `VerseWidgetSmallContent`/`VerseWidgetLargeContent` Composable(제목/본문/책이름 렌더링 + `clickable(clickAction)`)은 그대로 재사용한다 — `NoDataYet`/`Error`/`Loading` 상태도 전부 `Sermon` 객체로 변환해서 같은 Composable에 흘려보내므로, 어떤 상태든 위젯 탭으로 앱이 열리는 `clickAction`이 항상 살아있다(기존 `errorUiLayout`의 클릭 불가 문제를 구조적으로 해결).

- [ ] **Step 1: `WidgetContentStateMapping.kt` 작성 — `WidgetContentState<Sermon>` → `Sermon` 변환**

```kotlin
package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState

/**
 * 어떤 state든 기존 Content Composable로 그릴 수 있는 [Sermon]으로 변환한다.
 * NoDataYet/Error/Loading도 항상 clickAction이 붙은 정상 Composable 경로를 타므로,
 * 과거 errorUiLayout(네이티브 XML, 클릭 불가)로 빠지는 경로 자체가 없어진다.
 */
fun WidgetContentState<Sermon>.toDisplaySermon(): Sermon = when (this) {
    is WidgetContentState.Data -> value
    is WidgetContentState.Loading -> Sermon.noData(hasAppEverLaunched = false)
    is WidgetContentState.NoDataYet -> Sermon.noData(hasAppEverLaunched)
    is WidgetContentState.Error -> Sermon.errorSermon
}
```

- [ ] **Step 2: `VerseWidgetSmall.kt`의 `provideGlance()` 교체**

`android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt`에서 `class VerseWidgetSmall`의 `override suspend fun provideGlance(...)`를 다음으로 교체:

```kotlin
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val sermonRepository = getWidgetDependencies(context).sermonRepository()
        provideContent {
            val state by sermonRepository.sermonState.collectAsState()
            val sermon = state.toDisplaySermon()
            val clickAction = widgetClickAction(sermon.videoUrl, Constants.DEEP_LINK_SUNDAY_SERMON)
            VerseWidgetSmallContent(sermon, clickAction)
        }
    }
```

필요한 import 정리: `app.mannadev.meditation.analytics.CrashlyticsHelper`, `app.mannadev.meditation.data.hasAppEverLaunched`, `timber.log.Timber`는 더 이상 이 파일에서 안 쓰이면 제거. 새로 추가: `androidx.compose.runtime.getValue`, `androidx.compose.runtime.collectAsState`(Glance의 `provideContent` 블록은 `@Composable` 컨텍스트이므로 표준 Compose runtime의 `collectAsState`가 그대로 동작함 — `androidx.glance` 전용 버전이 아니라 `androidx.compose.runtime.collectAsState` import).

- [ ] **Step 3: `VerseWidgetLarge.kt`도 동일하게 교체**

```kotlin
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val sermonRepository = getWidgetDependencies(context).sermonRepository()
        provideContent {
            val state by sermonRepository.sermonState.collectAsState()
            val sermon = state.toDisplaySermon()
            val clickAction = widgetClickAction(sermon.videoUrl, Constants.DEEP_LINK_SUNDAY_SERMON)
            VerseWidgetLargeContent(sermon, clickAction)
        }
    }
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -80`
Expected: `VerseWidgetSmall.kt`/`VerseWidgetLarge.kt` 에러 사라짐. `QtWidgetSmall.kt`/`QtWidgetLarge.kt`만 남아야 함(Task 12).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLarge.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: Sermon 위젯이 collectAsState()로 반응형 state 구독

한 번 읽고 그리는 방식에서, Glance 세션이 열려있는 동안(~45초) sermonState
Flow를 구독하는 방식으로 전환. NoDataYet/Error도 항상 같은 Content
Composable(클릭 가능)로 렌더링해서, updateAll()이 여러 번 불려도
provideGlance가 재호출 안 되던 증상과 errorUiLayout의 클릭 불가 문제를
동시에 해결.
EOF
)"
```

---

## Task 12: QT 위젯 2개를 `collectAsState` 패턴으로 전환

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt`

**Interfaces:**
- Consumes: `getWidgetDependencies(context).qtRepository()`(Task 8), `QtRepository.qtState: StateFlow<WidgetContentState<QtDto>>`(Task 5).

- [ ] **Step 1: `WidgetContentStateMapping.kt`에 QT 변환 함수 추가**

Task 11 Step 1에서 만든 파일에 이어서 추가:

```kotlin
fun WidgetContentState<QtDto>.toDisplayQtUiModel(): QtWidgetUiModel = when (this) {
    is WidgetContentState.Data -> QtWidgetUiModel.fromDto(value)
    is WidgetContentState.Loading -> QtWidgetUiModel.error(hasAppEverLaunched = false)
    is WidgetContentState.NoDataYet -> QtWidgetUiModel.error(hasAppEverLaunched)
    is WidgetContentState.Error -> QtWidgetUiModel.error(hasAppEverLaunched = true)
}
```

파일 상단 import에 `app.mannadev.meditation.dto.QtDto`, `app.mannadev.meditation.ui.widget.qt.QtWidgetUiModel` 추가.

- [ ] **Step 2: `QtWidgetSmall.kt`의 `provideGlance()` 교체**

```kotlin
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val qtRepository = getWidgetDependencies(context).qtRepository()
        provideContent {
            val state by qtRepository.qtState.collectAsState()
            val uiModel = state.toDisplayQtUiModel()
            val clickAction = widgetClickAction(uiModel.videoUrl, Constants.DEEP_LINK_DAILY_MANNA)
            QtWidgetSmallContent(uiModel, clickAction)
        }
    }
```

- [ ] **Step 3: `QtWidgetLarge.kt`도 동일하게 교체**

```kotlin
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val qtRepository = getWidgetDependencies(context).qtRepository()
        provideContent {
            val state by qtRepository.qtState.collectAsState()
            val uiModel = state.toDisplayQtUiModel()
            val clickAction = widgetClickAction(uiModel.videoUrl, Constants.DEEP_LINK_DAILY_MANNA)
            QtWidgetLargeContent(uiModel, clickAction)
        }
    }
```

- [ ] **Step 4: 전체 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -80`
Expected: `BUILD SUCCESSFUL`, 에러 0건. (아직 안 쓰이는 import가 남아있으면 경고만 뜨고 빌드는 성공한다 — Task 14에서 정리.)

- [ ] **Step 5: 전체 유닛 테스트 실행**

Run: `cd android && ./gradlew :app:testDebugUnitTest 2>&1 | tail -60`
Expected: `BUILD SUCCESSFUL`. 기존 테스트(`BibleRepositoryTest` 등) + 신규 테스트(Task 4/5/9) 전부 통과.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/WidgetContentStateMapping.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: QT 위젯이 collectAsState()로 반응형 state 구독

Sermon과 동일한 패턴 적용. 이 커밋으로 전체 컴파일 + 유닛 테스트가 그린 상태.
EOF
)"
```

---

## Task 13: `onCompositionError()` 오버라이드로 진짜 크래시 로깅

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLarge.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt`

**Interfaces:**
- Consumes: `androidx.glance.appwidget.GlanceAppWidget.onCompositionError(context, glanceId, appWidgetId, throwable)`(Glance 1.1.0+ API).

Task 11/12로 대부분의 에러(빈 데이터, decode 실패)가 이제 정상 Composable 경로로 흡수됐지만, `errorUiLayout`(진짜 예상 못 한 크래시용 최후 안전망)은 여전히 남아있다. 지금은 거기로 빠지면 Crashlytics에 아무 기록도 안 남으므로, 오버라이드해서 로깅만 추가한다(레이아웃 자체는 유지).

- [ ] **Step 1: 4개 파일에 `onCompositionError` 오버라이드 추가**

각 `class XxxWidget : GlanceAppWidget(errorUiLayout = R.layout.xxx_error) { ... }` 안에 다음 메서드를 추가한다(`VerseWidgetSmall.kt` 예시, 나머지 3개도 클래스명/태그만 바꿔 동일하게):

```kotlin
    override fun onCompositionError(
        context: Context,
        glanceId: GlanceId,
        appWidgetId: Int,
        throwable: Throwable,
    ) {
        CrashlyticsHelper.recordException(throwable, "VerseWidgetSmall: uncaught composition error")
        super.onCompositionError(context, glanceId, appWidgetId, throwable)
    }
```

`VerseWidgetLarge.kt`는 메시지를 `"VerseWidgetLarge: uncaught composition error"`로, `QtWidgetSmall.kt`는 `"QtWidgetSmall: uncaught composition error"`로, `QtWidgetLarge.kt`는 `"QtWidgetLarge: uncaught composition error"`로 바꾼다. `super.onCompositionError(...)`를 호출해야 기존 `errorUiLayout` 표시 동작이 유지된다(공식 문서 확인: 오버라이드 시 기본 동작을 원하면 super 호출 필요).

- [ ] **Step 2: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -40`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLarge.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt \
        android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] feat: onCompositionError 오버라이드로 errorUiLayout 진입 시 Crashlytics 기록

지금까지 이 경로로 빠지면 아무 기록도 안 남았음. Task 11/12로 예상 가능한
에러는 대부분 정상 Composable 경로로 흡수됐으니, 여기 남는 건 진짜 예상 못한
크래시 — 최소한 원인 추적은 가능하게.
EOF
)"
```

---

## Task 14: `MainActivity.kt` 단순화 + `WidgetRefresh.kt` 제거 + 디버그 로그 정리

**Files:**
- Modify: `android/app/src/main/java/app/mannadev/meditation/MainActivity.kt`
- Delete: `android/app/src/main/java/app/mannadev/meditation/widget/WidgetRefresh.kt`
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetSmall.kt` (디버그 `Timber.d` 제거)
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/VerseWidgetLarge.kt` (디버그 `Timber.d` 제거)
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt` (디버그 `Timber.d` 제거)
- Modify: `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt` (디버그 `Timber.d` 제거)

**Interfaces:**
- Consumes: `getWidgetDependencies(context).sermonRepository()`/`.qtRepository()`, `WidgetUpdateNotifier`(Task 3, 8).

지금 uncommitted 상태로 남아있는 `MainActivity.onStart()`의 `refreshWidgetsFromPrefs()` 호출과 `WidgetRefresh.kt`는, 이제 위젯이 `collectAsState()`로 반응형 구독을 하기 때문에 원래 목적(warm 진입 시 prefs 최신값 재반영)이 자동으로 달성된다 — Glance 세션이 열릴 때(`updateAll()` 호출 시)마다 `sermonState`/`qtState`의 "현재" 값을 그대로 구독하므로, 굳이 "prefs만 다시 읽어서 그려라"라는 별도 경로가 필요 없다. 다만 **`onStart()`가 매번 `updateAll()`을 한 번 호출해서 Glance 세션 자체를 여는 것**은 여전히 유효하다(세션이 안 열려있으면 애초에 아무것도 구독을 안 하니까) — 이건 `WidgetUpdateNotifier`로 대체한다.

- [ ] **Step 1: `WidgetDependencies.kt`에 `WidgetUpdateNotifier` 노출 추가**

`Repository`는 read-only 구독(`sermonState`/`qtState`)만 노출하고 `WidgetUpdateNotifier`는 내부에서만 쓰므로, `MainActivity.onStart()`가 "세션만 열기" 위해서는 `WidgetUpdateNotifier`를 `WidgetDependencies`에도 직접 노출해야 한다. `android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt`(Task 8에서 만든 버전)에 한 줄 추가:

```kotlin
package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.data.WidgetPrefsDataSource
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetDependencies {
    fun sermonRepository(): SermonRepository
    fun qtRepository(): QtRepository
    fun widgetUpdateNotifier(): WidgetUpdateNotifier
    fun getWidgetPrefs(): WidgetPrefsDataSource
}

fun getWidgetDependencies(context: Context): WidgetDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        WidgetDependencies::class.java
    )
}
```

- [ ] **Step 2: `MainActivity.kt` 수정**

`android/app/src/main/java/app/mannadev/meditation/MainActivity.kt` 전체 교체:

```kotlin
package app.mannadev.meditation

import android.os.Bundle
import app.mannadev.meditation.data.markAppLaunched
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.widget.enqueueWidgetInitialSync
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "meditation_blossom"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(
            this,
            mainComponentName,
            DefaultNewArchitectureEntryPoint.fabricEnabled
        )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        markAppLaunched(this)
        // 위젯을 앱 미실행 상태로 선설치하면 설치 시점(onEnabled/provideGlance)의 Firestore
        // fallback이 백그라운드 실행 제한으로 서버에 못 닿아 빈 캐시만 받고 안내 문구에 머문다.
        // 앱을 실제로 연 이 시점(foreground)에는 조회가 성공하므로, 동일한 초기 동기화 worker를
        // 여기서 한 번 더 발동해 remote fetch → prefs 저장 → 위젯 재렌더 경로를 확실히 태운다.
        enqueueWidgetInitialSync(this)
    }

    override fun onStart() {
        super.onStart()
        // 위젯 탭 등으로 앱이 warm 진입하면 onCreate가 다시 호출되지 않는다. 위젯은
        // Repository의 StateFlow를 collectAsState()로 구독하므로, 여기서는 Glance 세션을
        // 여는 것(updateAll 1회)만 하면 된다 — 세션이 열리는 순간 현재 state를 그대로 반영한다.
        val notifier = getWidgetDependencies(this).widgetUpdateNotifier()
        CoroutineScope(Dispatchers.Default).launch {
            notifier.notifySermonChanged()
            notifier.notifyQtChanged()
        }
    }
}
```

- [ ] **Step 3: `WidgetRefresh.kt` 삭제**

```bash
git rm android/app/src/main/java/app/mannadev/meditation/widget/WidgetRefresh.kt
```

- [ ] **Step 4: 4개 위젯 파일의 디버그 계측 로그 제거**

이번 재설계 조사 중 추가했던 `Timber.d("VerseWidgetSmall: provideGlance CALLED...")` 같은 3줄(진입/데이터해석/렌더링)은 Task 11/12에서 `provideGlance()` 본문이 이미 통째로 교체됐으므로 자연스럽게 사라졌는지 확인한다:

Run: `grep -n "provideGlance CALLED\|provideContent RENDERING\|resolved verse\|resolved qt" android/app/src/main/java/app/mannadev/meditation/ui/widget/*.kt`
Expected: 결과 없음(0 matches). 남아있다면 Task 11/12에서 교체가 덜 된 것이므로 해당 라인을 지운다.

- [ ] **Step 5: 컴파일 확인**

Run: `cd android && ./gradlew :app:compileDebugKotlin 2>&1 | tail -40`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/app/mannadev/meditation/MainActivity.kt \
        android/app/src/main/java/app/mannadev/meditation/di/WidgetDependencies.kt
git rm android/app/src/main/java/app/mannadev/meditation/widget/WidgetRefresh.kt 2>/dev/null || true
git commit -m "$(cat <<'EOF'
[ISSUE-NONE] refactor: MainActivity.onStart 단순화, WidgetRefresh.kt 제거

위젯이 이제 StateFlow를 collectAsState()로 구독하므로, onStart()는
WidgetUpdateNotifier로 Glance 세션만 열어주면 된다 — 별도의
"prefs만 다시 읽어서 그리는" 함수가 더 이상 필요 없음.
EOF
)"
```

---

## Task 15: 실기기/에뮬레이터 회귀 검증 (수동, 자동화 불가)

**Files:** 없음(코드 변경 없음, 검증 전용 태스크).

**Interfaces:** 없음.

이 태스크는 유닛 테스트로 커버되지 않는 부분(Android 프로세스 생명주기, Glance 세션, WorkManager 실제 스케줄링, App Standby 제약)을 검증한다. 이번 세션에서 실제로 썼던 절차를 그대로 재사용한다.

- [ ] **Step 1: 디버그 빌드 설치**

Run: `yarn android` (또는 `cd android && ./gradlew installDebug`가 실패하면 `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`로 직접 설치)

- [ ] **Step 2: 완전 클린 상태로 시나리오 A 검증 — 위젯 설치 → 앱 미실행 → 위젯 탭**

```bash
adb uninstall app.mannadev.meditation.debug
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
```

에뮬레이터에서: 홈 화면에 Sermon/QT 위젯 추가(앱 열지 않음) → 잠시 대기 → 위젯 탭해서 앱 실행.

Run: `adb logcat -d -t 10000 | grep -iE "SermonRepositoryImpl|QtRepositoryImpl|WidgetInitialSyncWorker|WidgetUpdateNotifier|CrashlyticsHelper|empty snapshot"`
Expected: `syncFromRemote`/`save` 관련 흐름이 로그로 확인되고(직접 로그를 안 심었다면 최소한 크래시 없이 `WM-WorkerWrapper: Worker result SUCCESS`가 찍힘), 위젯이 최종적으로 실제 설교/QT 내용을 표시한다(스크린샷으로 확인).

- [ ] **Step 3: 시나리오 B 검증 — 앱이 이미 열려있는 상태에서 데이터 변경 후 위젯 반영**

앱을 포그라운드에 둔 채로, Firestore 콘솔이나 FCM 테스트 메시지로 새 설교/QT를 푸시(또는 설정 화면의 "데이터 새로고침" 버튼 사용) → 위젯이 자동으로 갱신되는지 홈 화면 스크린샷으로 확인.
Expected: 이전엔 이 시나리오에서 `updateAll()`을 여러 번 불러도 `provideGlance()`가 재호출 안 되는 경우가 재현됐었다(2026-07-08~09 세션) — 이번엔 Glance 세션이 열려있는 동안 `collectAsState()`가 새 값을 즉시 반영해야 한다.

- [ ] **Step 4: 시나리오 C 검증 — 손상된 prefs로 Error state 클릭 가능 여부**

```bash
adb shell run-as app.mannadev.meditation.debug sh -c "echo 'not valid json' > /data/data/app.mannadev.meditation.debug/shared_prefs/sermon_prefs.xml" 2>/dev/null || echo "run-as 권한 문제 시 디버그 빌드에서 재시도"
```

(디버그 빌드가 아니면 `run-as`가 막힐 수 있음 — 안 되면 앱 내부에서 임시로 잘못된 JSON을 주입하는 디버그 메뉴를 활용하거나 스킵하고 코드 리뷰로 대체.) 위젯을 새로고침(앱 재실행 등)해서 `WidgetContentState.Error`가 뜨는지, 그 상태에서 위젯을 탭했을 때 앱이 정상적으로 열리는지 확인.
Expected: 에러 상태에서도 위젯 탭이 정상 동작(과거 `errorUiLayout`의 클릭 불가 버그 재발 안 함).

- [ ] **Step 5: 최종 전체 테스트 스위트 + 린트**

Run: `cd android && ./gradlew :app:testDebugUnitTest :app:lintDebug 2>&1 | tail -80`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: 결과를 커밋 메시지 없이 기록만(코드 변경 없으므로 커밋 불필요)**

이 태스크는 검증 전용이라 git commit이 없다. 문제가 발견되면 해당 Task로 돌아가 수정 후 재검증한다.

---

## Self-Review Notes (작성자용, 실행 시 참고)

- **Spec coverage**: spec의 §6 Component Changes 표에 있는 모든 파일이 Task 1~14에 등장한다. `WidgetPrefsDataSource`(youtube-link 설정)는 이 리팩터 범위 밖이라 손대지 않음 — DI 인터페이스에서 계속 노출만 됨.
- **QT `onClear` 미연결**: 현재도 `ClearQtPreferenceUseCase`가 어디서도 호출되지 않는 기존 dead code였다(Task 8에서 확인). 이 플랜은 `QtRepository.clear()`를 만들지만 `WidgetUpdateModule.onClear()`에 연결하지 않는다 — 기존 동작(Sermon만 클리어)을 그대로 보존하기 위함. QT clear 배선은 이 플랜의 범위가 아니다.
- **Type consistency 확인**: `SermonRepository.sermonState`(Task 4) → `VerseWidgetSmall`/`Large`(Task 11)에서 동일 타입(`StateFlow<WidgetContentState<Sermon>>`) 사용. `QtRepository.qtState`(Task 5) → `QtWidgetSmall`/`Large`(Task 12)에서 `StateFlow<WidgetContentState<QtDto>>` 일관. `WidgetUpdateNotifier.notifySermonChanged()`/`notifyQtChanged()`(Task 3) 시그니처가 Task 4/5/14에서 동일하게 쓰임.
- **AppModule.kt 원본 대조 필요**: Task 4 Step 5는 `AppModule.kt` 전체를 교체하는데, 원본에 있던 `EditableSermonDataSource`/`SermonDataSource`/`@Qualifier` import가 실제로 안 쓰이고 있었다는 걸 이번 세션 코드 읽기로 확인했지만, 실행 담당자는 Step 5 전에 반드시 `git show HEAD:android/app/src/main/java/app/mannadev/meditation/di/AppModule.kt`로 최신 원본을 한 번 더 확인하고 진행할 것(다른 브랜치 병합 등으로 그 사이 바뀌었을 수 있음).
