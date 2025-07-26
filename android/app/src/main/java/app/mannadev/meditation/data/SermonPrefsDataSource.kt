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
) : EditableSermonDataSource {

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
        prefs.edit(commit = true) {
            putString(KEY_DISPLAY_SERMON_JSON, json.encodeToString(sermon))
        }
    }

    override suspend fun clearDisplaySermon() = withContext(Dispatchers.IO) {
        prefs.edit(commit = true) {
            remove(KEY_DISPLAY_SERMON_JSON)
        }
    }
}