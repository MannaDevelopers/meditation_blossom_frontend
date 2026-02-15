package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.Source
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

class SermonNotFoundException(message: String) : Exception(message)
class FirestoreFetchException(message: String, cause: Throwable? = null) : Exception(message, cause)

@Singleton
class SermonFirestoreDataSource @Inject constructor(
    private val firestore: FirebaseFirestore
) {

    suspend fun getDisplaySermonFromCache(): SermonDto? = withContext(Dispatchers.IO) {
        fetchFromRemote(source = Source.CACHE)
    }

    private suspend fun fetchFromRemote(source: Source): SermonDto {
        return try {
            val querySnapshot = firestore.collection("sermons")
                .orderBy("date", Query.Direction.DESCENDING)
                .limit(1)
                .get(source)
                .await() // Use await() here

            snapshotToSermonDto(querySnapshot)
        } catch (e: Exception) {
            // Consider more specific exception handling or re-throwing
            throw FirestoreFetchException("Error fetching sermon from Firestore", e)
        }
    }

    private fun snapshotToSermonDto(snapshot: QuerySnapshot): SermonDto {
        if (snapshot.isEmpty) {
            throw SermonNotFoundException("Sermon document list was empty unexpectedly after non-empty snapshot.")
        }
        val document = snapshot.documents.first()
        return document.data?.let { map ->
            SermonDto(
                date = map["date"] as String,
                title = map["title"] as String,
                content = map["content"] as String,
                dayOfWeek = map["day_of_week"] as String,
            )
        } ?: throw SermonNotFoundException("No sermons found in Firestore")
    }
}