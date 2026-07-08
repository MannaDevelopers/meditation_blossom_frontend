package app.mannadev.meditation.data

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.model.Sermon
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonRepositoryImpl @Inject constructor(
    private val prefsDataSource: SermonPrefsDataSource,
    private val firestoreDataSource: SermonFirestoreDataSource
) : SermonRepository {

    override suspend fun getDisplaySermon(): Sermon? {
        prefsDataSource.getDisplaySermon()?.let { return Sermon.fromDto(it) }

        // prefs가 비어있음 (예: 메인 앱을 한 번도 열지 않고 위젯만 설치한 경우).
        // Firestore에서 직접 최신 설교를 가져와 prefs를 채운 뒤 반환한다.
        return runCatching { firestoreDataSource.fetchLatestSermon() }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "Sermon widget: Firestore fallback fetch failed")
            }
            .getOrNull()
            ?.also { prefsDataSource.saveDisplaySermon(it) }
            ?.let { Sermon.fromDto(it) }
    }

}