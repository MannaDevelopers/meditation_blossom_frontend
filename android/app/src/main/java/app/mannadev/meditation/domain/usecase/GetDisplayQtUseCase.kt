package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.data.QtFirestoreDataSource
import app.mannadev.meditation.data.QtPrefsDataSource
import app.mannadev.meditation.dto.QtDto
import javax.inject.Inject

class GetDisplayQtUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource,
    private val firestoreDataSource: QtFirestoreDataSource,
) {
    suspend operator fun invoke(): QtDto? {
        prefsDataSource.getDisplayQt()?.let { return it }

        // prefs가 비어있음 (예: 메인 앱을 한 번도 열지 않고 위젯만 설치한 경우).
        // Firestore에서 직접 최신 QT를 가져와 prefs를 채운 뒤 반환한다.
        return runCatching { firestoreDataSource.fetchLatestQt() }
            .onFailure { e ->
                CrashlyticsHelper.recordException(e, "QT widget: Firestore fallback fetch failed")
            }
            .getOrNull()
            ?.also { prefsDataSource.saveDisplayQt(it) }
    }
}
