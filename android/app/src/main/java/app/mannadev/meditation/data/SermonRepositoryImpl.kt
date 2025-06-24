package app.mannadev.meditation.data

import app.mannadev.meditation.domain.SermonRepository
import app.mannadev.meditation.dto.VerseDto
import app.mannadev.meditation.model.Verse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonRepositoryImpl @Inject constructor(
    private val sermonLocalDataSource: SermonDataSource
) : SermonRepository {
    companion object {
        private val json = Json {
            ignoreUnknownKeys = true // JSON에 정의되지 않은 키를 무시
        }
    }

    override suspend fun getDisplaySermon(): Verse? {
        return withContext(Dispatchers.IO) {
            val sermonJsonString =
                sermonLocalDataSource.getDisplaySermonJson() ?: return@withContext null
            try {
                val verseDto = json.decodeFromString<List<VerseDto>>(sermonJsonString).first()
                Verse.Companion.fromDto(verseDto)
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }
}