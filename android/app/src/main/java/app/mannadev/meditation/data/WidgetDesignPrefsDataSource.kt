package app.mannadev.meditation.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.edit
import androidx.core.net.toUri
import app.mannadev.meditation.dto.WidgetDesignDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WidgetDesignPrefsDataSource @Inject constructor(
    @ApplicationContext private val context: Context,
) : WidgetDesignPrefsSource {

    companion object {
        private const val PREFS_NAME = "widget_design_prefs"
        private const val KEY_DESIGN_JSON = "widget_design_json"
        private const val BACKGROUND_IMAGE_FILE_NAME = "widget_design_background.jpg"

        // 위젯 배경 Bitmap은 RemoteViews/Binder IPC로 위젯 호스트 프로세스에 전달되는데, 그 전송에는
        // 용량 제약(TransactionTooLargeException, 대략 1MB 안팎)이 있다. 원본 그대로 저장하지 않고
        // 이 크기로 다운샘플링 + JPEG 압축해 항상 안전한 크기로 유지한다.
        private const val MAX_BACKGROUND_DIMENSION_PX = 1024
        private const val BACKGROUND_JPEG_QUALITY = 85

        private val json = Json { ignoreUnknownKeys = true }
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override suspend fun getDesign(): WidgetDesignDto? = withContext(Dispatchers.IO) {
        val jsonString = prefs.getString(KEY_DESIGN_JSON, null)
        if (jsonString.isNullOrBlank()) return@withContext null
        try {
            json.decodeFromString<WidgetDesignDto>(jsonString)
        } catch (e: Exception) {
            throw RuntimeException("Error decoding widget design JSON: $jsonString", e)
        }
    }

    override suspend fun saveDesign(design: WidgetDesignDto): WidgetDesignDto = withContext(Dispatchers.IO) {
        val persisted = if (design.background.type == "gallery") {
            val localPath = processAndStoreBackgroundImage(design.background.value)
            design.copy(background = design.background.copy(value = localPath))
        } else {
            design
        }
        prefs.edit {
            putString(KEY_DESIGN_JSON, json.encodeToString(persisted))
        }
        persisted
    }

    override suspend fun clearDesign() = withContext(Dispatchers.IO) {
        prefs.edit { remove(KEY_DESIGN_JSON) }
        backgroundImageFile().delete()
        Unit
    }

    private fun backgroundImageFile(): File = File(context.filesDir, BACKGROUND_IMAGE_FILE_NAME)

    /**
     * RN에서 넘어온 원본 이미지 URI(시스템 포토 피커의 임시 content:// 등)를 앱 내부 저장소의
     * 고정 경로로 복사하면서 다운샘플링 + JPEG 압축한다. 원본 URI는 임시 참조일 수 있어(피커가
     * 반환한 캐시 URI 등), 위젯 프로세스가 항상 접근 가능한 앱 전용 저장소에 안정적으로 보관해야 한다.
     * 매번 같은 파일명에 덮어써 이전 배경이 갤러리에 남아 용량이 누적되지 않게 한다.
     */
    private fun processAndStoreBackgroundImage(sourceUriString: String): String {
        val uri = sourceUriString.toUri()
        val bitmap = decodeSampledBitmap(uri, MAX_BACKGROUND_DIMENSION_PX)
            ?: throw IllegalStateException("Unable to decode background image: $sourceUriString")
        val outFile = backgroundImageFile()
        try {
            FileOutputStream(outFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, BACKGROUND_JPEG_QUALITY, out)
            }
        } finally {
            bitmap.recycle()
        }
        return outFile.absolutePath
    }

    /**
     * react-native-image-picker는 시스템 포토 피커에서 고른 사진을 앱 캐시로 복사한 뒤
     * file:// 경로를 돌려준다 — 이 경우 ContentResolver를 거치지 않고 File I/O로 직접 읽는
     * 편이 더 안정적이다(ContentResolver.openInputStream이 file:// 스킴에서 null을 반환하며
     * 실패하는 경우가 있었다). content://(직접 MediaStore URI 등)는 기존대로 ContentResolver를 쓴다.
     */
    private fun openUriInputStream(uri: Uri) =
        if (uri.scheme == "file" && uri.path != null) {
            File(uri.path!!).inputStream()
        } else {
            context.contentResolver.openInputStream(uri)
        }

    /**
     * 표준 Android 2-pass 다운샘플링 패턴 — bounds만 먼저 읽어 원본을 메모리에 통째로 올리지 않는다.
     * inJustDecodeBounds=true일 때 BitmapFactory.decodeStream은 항상 null을 반환하는 게 API 규약이라
     * (Options에 outWidth/outHeight만 채워질 뿐 Bitmap은 만들지 않음), 그 반환값 자체를 스트림 오픈
     * 성공 여부로 오해해 조기 반환하면 안 된다 — 스트림이 null인지(오픈 실패)만 확인한다.
     */
    private fun decodeSampledBitmap(uri: Uri, maxDimension: Int): Bitmap? {
        val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        val boundsStream = openUriInputStream(uri) ?: return null
        boundsStream.use { stream -> BitmapFactory.decodeStream(stream, null, boundsOptions) }

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = calculateInSampleSize(boundsOptions, maxDimension, maxDimension)
        }
        val decodeStream = openUriInputStream(uri) ?: return null
        return decodeStream.use { stream -> BitmapFactory.decodeStream(stream, null, decodeOptions) }
    }

    private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val height = options.outHeight
        val width = options.outWidth
        var inSampleSize = 1
        if (height > reqHeight || width > reqWidth) {
            val halfHeight = height / 2
            val halfWidth = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }
}
