package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.BibleReferenceResolver
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QtFirestoreDataSource @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val bibleReferenceResolver: BibleReferenceResolver,
) {
    /** 위젯이 prefs 없이 단독 설치됐을 때를 위한 fallback. Firestore에서 최신 QT 1건을 직접 조회한다. */
    suspend fun fetchLatestQt(): QtDto? = withContext(Dispatchers.IO) {
        val snapshot = try {
            firestore.collection("qt")
                .orderBy("date", Query.Direction.DESCENDING)
                .limit(1)
                .get()
                .await()
        } catch (e: Exception) {
            throw FirestoreFetchException("Error fetching QT from Firestore", e)
        }
        if (snapshot.isEmpty) return@withContext null
        val data = snapshot.documents.first().data ?: return@withContext null

        val date = data["date"] as? String ?: return@withContext null
        val title = data["title"] as? String ?: return@withContext null
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
