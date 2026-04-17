package app.mannadev.meditation.data.bible

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import app.mannadev.meditation.analytics.CrashlyticsHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 번들된 `bible.db` 자산을 앱 내부 DB 경로로 복사하고, 프로세스 수명 동안 단일
 * 읽기 전용 [SQLiteDatabase] 핸들을 유지한다.
 *
 * Lifecycle 계약:
 * - `@Singleton` 로 Hilt 컨테이너가 프로세스당 1개 인스턴스를 보장한다.
 * - [ensureOpen] 은 Double-Checked Locking 으로 최초 1회만 DB 를 연다.
 * - 한 번 연 핸들은 **절대 close 하지 않는다**. 프로세스가 살아 있는 한 읽기 전용
 *   쿼리에 재사용되며, OS 가 프로세스를 종료할 때 함께 해제된다. 수동 close 는
 *   DCL 불변식을 깨뜨려 이후 호출이 닫힌 DB 에 접근할 수 있으므로 **추가하지 말 것**.
 * - 자산이 갱신된 경우 ([copyFromAssetsIfNeeded] 에서 meta 비교로 감지) 에만
 *   기존 파일을 삭제하고 임시파일 → atomic rename 으로 교체한다.
 */
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
        val assetMeta = readAssetMeta()
        if (target.exists()) {
            // 자산 meta 읽기가 실패한 경우(null, null) 디스크 파일을 신뢰하고 보존한다.
            // 저장공간 부족/OS kill 등 일시적 사유로 기존 정상 DB 를 삭제하지 않도록 한다.
            if (assetMeta.sourceSha == null && assetMeta.schemaVersion == null) return
            val fileMeta = readFileMetaPair(target)
            if (fileMeta.sourceSha == assetMeta.sourceSha &&
                fileMeta.schemaVersion == assetMeta.schemaVersion
            ) {
                return
            }
        }
        // 임시파일에 쓰고 fsync 후 rename 하여 torn-file 위험을 제거한다.
        val parent = target.parentFile
        val tmp = File(parent, "${target.name}.tmp")
        try {
            context.assets.open(DB_NAME).use { input ->
                FileOutputStream(tmp).use { output ->
                    input.copyTo(output)
                    output.fd.sync()
                }
            }
            if (target.exists() && !target.delete()) {
                throw BibleDbInitException("Failed to delete stale target: ${target.path}")
            }
            if (!tmp.renameTo(target)) {
                throw BibleDbInitException("Rename failed: ${tmp.path} -> ${target.path}")
            }
        } catch (e: Exception) {
            tmp.delete()
            Timber.e(e, "Failed to copy bible.db from assets")
            CrashlyticsHelper.recordException(e, "BibleDbImpl.copyFromAssets failed")
            if (e is BibleDbInitException) throw e
            throw BibleDbInitException("copyFromAssets failed", e)
        }
    }

    private fun readAssetMeta(): BibleMeta {
        val tmp = File.createTempFile("bible-asset-meta", ".db", context.cacheDir)
        try {
            context.assets.open(DB_NAME).use { input ->
                tmp.outputStream().use { output -> input.copyTo(output) }
            }
            return readMetaPair(tmp)
        } catch (e: Exception) {
            Timber.w(e, "Failed to read asset meta")
            return BibleMeta(null, null)
        } finally {
            tmp.delete()
        }
    }

    private fun readFileMetaPair(file: File): BibleMeta = runCatching { readMetaPair(file) }
        .getOrElse { BibleMeta(null, null) }

    private fun readMetaPair(file: File): BibleMeta {
        val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
        try {
            var sha: String? = null
            var schema: String? = null
            db.rawQuery(
                "SELECT key, value FROM meta WHERE key IN ('source_sha','schema_version')",
                null,
            ).use { c ->
                while (c.moveToNext()) {
                    when (c.getString(0)) {
                        "source_sha" -> sha = c.getString(1)
                        "schema_version" -> schema = c.getString(1)
                    }
                }
            }
            return BibleMeta(sha, schema)
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

    private data class BibleMeta(val sourceSha: String?, val schemaVersion: String?)

    companion object {
        const val DB_NAME = "bible.db"
    }
}
