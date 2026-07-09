package app.mannadev.meditation.data

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.BibleReferenceResolver
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QtFirestoreDataSource @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val bibleReferenceResolver: BibleReferenceResolver,
) : QtRemoteSource {
    /** 위젯이 prefs 없이 단독 설치됐을 때를 위한 fallback. Firestore에서 최신 QT 1건을 직접 조회한다. */
    override suspend fun fetchLatestQt(): QtDto? = withContext(Dispatchers.IO) {
        val snapshot = try {
            firestore.collection("qt")
                .orderBy("date", Query.Direction.DESCENDING)
                .limit(1)
                .get(Source.SERVER)
                .await()
        } catch (e: Exception) {
            throw FirestoreFetchException("Error fetching QT from Firestore", e)
        }
        if (snapshot.isEmpty) {
            CrashlyticsHelper.recordException(
                FirestoreFetchException("qt collection returned no documents"),
                "QtFirestoreDataSource: empty snapshot",
            )
            return@withContext null
        }
        val data = snapshot.documents.first().data ?: return@withContext null

        val date = data["date"] as? String ?: run {
            CrashlyticsHelper.recordException(
                FirestoreFetchException("qt doc missing/invalid 'date' field. keys=${data.keys}"),
                "QtFirestoreDataSource: date field missing",
            )
            return@withContext null
        }
        val title = data["title"] as? String ?: run {
            CrashlyticsHelper.recordException(
                FirestoreFetchException("qt doc missing/invalid 'title' field. keys=${data.keys}"),
                "QtFirestoreDataSource: title field missing",
            )
            return@withContext null
        }
        @Suppress("UNCHECKED_CAST")
        val meditationQuestions = (data["meditation_questions"] as? List<String>) ?: emptyList()

        QtDto(
            date = date,
            title = title,
            seriesTitle = data["series_title"] as? String ?: "",
            content = resolveFirestoreContent(bibleReferenceResolver, data),
            dayOfWeek = data["day_of_week"] as? String ?: "",
            videoUrl = (data["video_url"] as? String)?.takeIf { it.isNotBlank() },
            meditationQuestions = meditationQuestions,
        )
    }
}
