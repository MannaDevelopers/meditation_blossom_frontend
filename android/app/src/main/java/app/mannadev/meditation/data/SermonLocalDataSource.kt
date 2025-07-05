package app.mannadev.meditation.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.compose.runtime.withFrameNanos
import app.mannadev.meditation.dto.SermonDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonLocalDataSource @Inject constructor(
    @ApplicationContext private val context: Context
) : SermonDataSource {
    companion object {
        private val json = Json {
            ignoreUnknownKeys = true // JSON에 정의되지 않은 키를 무시
        }
    }

    private fun getDisplaySermonJson(): String? {
        val dbFile = context.getDatabasePath("RKStorage")
        if (!dbFile.exists()) {
            return null
        }
        var db: SQLiteDatabase? = null
        return try {
            db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READONLY)
            val cursor = db.query(
                "catalystLocalStorage",
                arrayOf("value"),
                "key = ?",
                arrayOf("display_sermon"),
                null,
                null,
                null
            )

            var value: String? = null
            if (cursor.moveToFirst()) {
                value = cursor.getString(cursor.getColumnIndexOrThrow("value"))
            }
            cursor.close()
            value
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            db?.close()
        }
    }

    override suspend fun getDisplaySermon(): SermonDto? = withContext(Dispatchers.IO) {
        val sermonJsonString = getDisplaySermonJson()
        if (sermonJsonString.isNullOrBlank()) return@withContext null

        try {
            json.decodeFromString<List<SermonDto>>(sermonJsonString).first()
        } catch (e: Exception) {
            throw RuntimeException("Error decoding sermon JSON", e)
        }
    }

    override suspend fun saveDisplaySermon(sermon: SermonDto) {
        throw NotImplementedError("Saving sermons is not supported in Sqlite data source")
    }

}