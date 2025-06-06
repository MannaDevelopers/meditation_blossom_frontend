package app.mannadev.meditation.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import app.mannadev.meditation.dto.VerseDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File

interface SermonRepository {
    suspend fun getDisplaySermon(): Verse?
}

class SermonRepositoryImpl(
    private val sermonLocalDataSource: SermonLocalDataSource
) : SermonRepository {
    override suspend fun getDisplaySermon(): Verse? {
        return withContext(Dispatchers.IO) {
            val sermonJsonString =
                sermonLocalDataSource.getDisplaySermonJson() ?: return@withContext null
            try {
                val verseDto = Json.decodeFromString<VerseDto>(sermonJsonString)
                Verse.fromDto(verseDto)
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }
}

class SermonLocalDataSource(private val context: Context) {
    fun getDisplaySermonJson(): String? {
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
} 