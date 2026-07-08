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
