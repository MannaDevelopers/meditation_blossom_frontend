package app.mannadev.meditation.data

import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.model.Sermon
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonRepositoryImpl @Inject constructor(
    private val prefsDataSource: SermonPrefsDataSource,
    private val firestoreDataSource: SermonFirestoreDataSource
) : SermonRepository {

    /**
     * TODO: Datasource 우선순위: firestore cache, prefs 에서 가져온걸 날짜로 비교 -> firestore server
     */
    override suspend fun getDisplaySermon(): Sermon? {
        return prefsDataSource.getDisplaySermon()?.let {
            Sermon.fromDto(it)
        }
    }

}