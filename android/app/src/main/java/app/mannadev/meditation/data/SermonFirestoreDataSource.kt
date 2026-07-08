package app.mannadev.meditation.data

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.dto.SermonDto
import app.mannadev.meditation.model.BibleReferenceResolver
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
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
) {
    /** 위젯이 prefs 없이 단독 설치됐을 때를 위한 fallback. Firestore에서 최신 설교 1건을 직접 조회한다. */
    suspend fun fetchLatestSermon(): SermonDto? = withContext(Dispatchers.IO) {
        val snapshot = try {
            firestore.collection("sermons")
                .orderBy("date", Query.Direction.DESCENDING)
                .limit(1)
                .get()
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
