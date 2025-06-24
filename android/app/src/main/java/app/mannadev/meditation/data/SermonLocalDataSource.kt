package app.mannadev.meditation.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SermonLocalDataSource @Inject constructor(
    @ApplicationContext private val context: Context
): SermonDataSource {
    override fun getDisplaySermonJson(): String? {
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