package app.mannadev.meditation.data.bible

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import app.mannadev.meditation.analytics.CrashlyticsHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BibleDbImpl @Inject constructor(
    @ApplicationContext private val context: Context,
) : BibleDb {

    private val lock = Any()
    @Volatile private var openedDb: SQLiteDatabase? = null

    private fun ensureOpen(): SQLiteDatabase {
        openedDb?.let { return it }
        synchronized(lock) {
            openedDb?.let { return it }
            val target = context.getDatabasePath(DB_NAME).apply {
                parentFile?.mkdirs()
            }
            copyFromAssetsIfNeeded(target)
            val db = try {
                SQLiteDatabase.openDatabase(target.path, null, SQLiteDatabase.OPEN_READONLY)
            } catch (e: Exception) {
                Timber.e(e, "Failed to open bible.db at %s", target.path)
                CrashlyticsHelper.recordException(e, "BibleDbImpl.openDatabase failed")
                throw BibleDbInitException("openDatabase failed: ${target.path}", e)
            }
            openedDb = db
            return db
        }
    }

    private fun copyFromAssetsIfNeeded(target: File) {
        val assetSha = readAssetMeta("source_sha")
        val assetSchema = readAssetMeta("schema_version")
        if (target.exists()) {
            val current = runCatching { readFileMeta(target, "source_sha") }.getOrNull()
            val currentSchema = runCatching { readFileMeta(target, "schema_version") }.getOrNull()
            if (current == assetSha && currentSchema == assetSchema) return
            // asset 쪽이 달라졌으면 기존 DB 제거 후 재복사
            target.delete()
        }
        try {
            context.assets.open(DB_NAME).use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to copy bible.db from assets")
            CrashlyticsHelper.recordException(e, "BibleDbImpl.copyFromAssets failed")
            throw BibleDbInitException("copyFromAssets failed", e)
        }
    }

    private fun readAssetMeta(key: String): String? {
        val tmp = File.createTempFile("bible-asset-meta", ".db", context.cacheDir)
        try {
            context.assets.open(DB_NAME).use { input ->
                tmp.outputStream().use { output -> input.copyTo(output) }
            }
            return readFileMeta(tmp, key)
        } catch (e: Exception) {
            Timber.w(e, "Failed to read asset meta key=%s", key)
            return null
        } finally {
            tmp.delete()
        }
    }

    private fun readFileMeta(file: File, key: String): String? {
        val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
        try {
            db.rawQuery("SELECT value FROM meta WHERE key = ?", arrayOf(key)).use { c ->
                return if (c.moveToFirst()) c.getString(0) else null
            }
        } finally {
            db.close()
        }
    }

    override fun loadBookIdByName(): Map<String, Int> {
        val db = ensureOpen()
        val map = LinkedHashMap<String, Int>(66)
        db.rawQuery("SELECT id, name FROM books", null).use { c ->
            while (c.moveToNext()) {
                map[c.getString(1)] = c.getInt(0)
            }
        }
        return map
    }

    override fun queryRange(
        bookId: Int,
        chapter: Int,
        startVerse: Int,
        endVerse: Int,
    ): List<BibleDb.VerseRow> {
        val db = ensureOpen()
        val rows = ArrayList<BibleDb.VerseRow>(endVerse - startVerse + 1)
        db.rawQuery(
            "SELECT verse, text FROM verses WHERE book_id = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse",
            arrayOf(bookId.toString(), chapter.toString(), startVerse.toString(), endVerse.toString()),
        ).use { c ->
            while (c.moveToNext()) {
                rows.add(BibleDb.VerseRow(verse = c.getInt(0), text = c.getString(1)))
            }
        }
        return rows
    }

    companion object {
        const val DB_NAME = "bible.db"
    }
}
