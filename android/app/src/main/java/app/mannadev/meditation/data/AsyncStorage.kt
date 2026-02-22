package app.mannadev.meditation.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import app.mannadev.meditation.analytics.CrashlyticsHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AsyncStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {

    fun get(key: String): String? {
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
                arrayOf(key),
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
            Timber.e(e, "AsyncStorage.get failed for key: $key")
            CrashlyticsHelper.recordException(e, "AsyncStorage.get failed for key: $key")
            null
        } finally {
            db?.close()
        }
    }

    /**
     * Sets the value for the given key in the AsyncStorage.
     * If the key already exists, its value will be updated. Otherwise, a new entry will be created.
     *
     * @param key The key to set.
     * @param value The value to associate with the key.
     * @throws IllegalStateException if the database file does not exist.
     */
    fun set(key: String, value: String) {
        val dbFile = context.getDatabasePath("RKStorage")
        if (!dbFile.exists()) {
            throw IllegalStateException("Database file does not exist: ${dbFile.path}")
        }

        var db: SQLiteDatabase? = null
        try {
            db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READWRITE)

            val values = android.content.ContentValues()
            values.put("key", key)
            values.put("value", value)

            val rowsAffected = db.update("catalystLocalStorage", values, "key = ?", arrayOf(key))
            if (rowsAffected == 0) {
                db.insert("catalystLocalStorage", null, values)
            }
        } catch (e: Exception) {
            Timber.e(e, "AsyncStorage.set failed for key: $key")
            CrashlyticsHelper.recordException(e, "AsyncStorage.set failed for key: $key")
            throw e
        } finally {
            db?.close()
        }
    }

}