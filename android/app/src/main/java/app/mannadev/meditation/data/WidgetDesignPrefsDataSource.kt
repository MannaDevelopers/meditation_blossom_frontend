package app.mannadev.meditation.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.core.content.edit
import androidx.core.net.toUri
import androidx.exifinterface.media.ExifInterface
import app.mannadev.meditation.dto.WidgetDesignDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class WidgetDesignPrefsDataSource(
    @ApplicationContext private val context: Context,
    private val contentType: WidgetContentType,
) : WidgetDesignPrefsSource {

    companion object {
        private const val PREFS_NAME = "widget_design_prefs"

        // 위젯 배경 Bitmap은 RemoteViews/Binder IPC로 위젯 호스트 프로세스에 전달되는데, 그 전송에는
        // 용량 제약(TransactionTooLargeException, 대략 1MB 안팎)이 있다. 원본 그대로 저장하지 않고
        // 이 크기로 다운샘플링 + JPEG 압축해 항상 안전한 크기로 유지한다.
        private const val MAX_BACKGROUND_DIMENSION_PX = 1024
        private const val BACKGROUND_JPEG_QUALITY = 85

        private val json = Json { ignoreUnknownKeys = true }
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // 주일 말씀/QT가 서로의 디자인을 덮어쓰지 않도록 SharedPreferences 키와 배경 이미지 파일명을
    // 콘텐츠 타입별로 분리한다([ISSUE-236]).
    private val keyDesignJson: String
        get() = "widget_design_json_${contentType.storageSuffix}"

    override suspend fun getDesign(): WidgetDesignDto? = withContext(Dispatchers.IO) {
        val jsonString = prefs.getString(keyDesignJson, null)
        if (jsonString.isNullOrBlank()) return@withContext null
        try {
            json.decodeFromString<WidgetDesignDto>(jsonString)
        } catch (e: Exception) {
            throw RuntimeException("Error decoding widget design JSON: $jsonString", e)
        }
    }

    override suspend fun saveDesign(design: WidgetDesignDto): WidgetDesignDto = withContext(Dispatchers.IO) {
        val previousBackgroundPath = galleryBackgroundPath(prefs.getString(keyDesignJson, null))
        val persisted = if (design.background.type == "gallery") {
            val localPath = processAndStoreBackgroundImage(design.background.value)
            design.copy(background = design.background.copy(value = localPath))
        } else {
            design
        }
        prefs.edit {
            putString(keyDesignJson, json.encodeToString(persisted))
        }
        // 이전 배경이 갤러리 사진이었고 이번 저장으로 다른 경로가 됐다면(새 사진 적용, 또는
        // 배경색으로 전환) 저장 공간에 계속 쌓이지 않도록 정리한다([ISSUE-258] 후속).
        val newGalleryPath = persisted.background.takeIf { it.type == "gallery" }?.value
        if (previousBackgroundPath != null && previousBackgroundPath != newGalleryPath) {
            File(previousBackgroundPath).delete()
        }
        persisted
    }

    override suspend fun clearDesign() = withContext(Dispatchers.IO) {
        val currentBackgroundPath = galleryBackgroundPath(prefs.getString(keyDesignJson, null))
        prefs.edit { remove(keyDesignJson) }
        currentBackgroundPath?.let { File(it).delete() }
        Unit
    }

    private fun galleryBackgroundPath(designJson: String?): String? {
        if (designJson.isNullOrBlank()) return null
        return try {
            json.decodeFromString<WidgetDesignDto>(designJson).background.takeIf { it.type == "gallery" }?.value
        } catch (e: Exception) {
            null
        }
    }

    // 저장할 때마다 고유 파일명(UUID)을 쓴다([ISSUE-258]) — 콘텐츠 타입별 고정 파일명에 매번
    // 덮어쓰면 배경 사진을 바꿔 저장해도 background.value(파일 경로) 문자열이 그대로라, RN
    // <Image>(Fresco, Android)가 그 경로로 예전에 캐시해둔 사진을 재사용해 편집 화면 재진입 시
    // 예전 사진이 보이는 문제가 있었다(iOS도 #249에서 비슷한 이유로 동일한 방식을 먼저 적용).
    // 이전 파일 정리는 saveDesign()/clearDesign()이 담당한다.
    private fun newBackgroundImageFile(): File =
        File(context.filesDir, "widget_design_background_${contentType.storageSuffix}_${UUID.randomUUID()}.jpg")

    /**
     * RN에서 넘어온 원본 이미지 URI(시스템 포토 피커의 임시 content:// 등)를 앱 내부 저장소의
     * 새 고유 경로로 복사하면서 다운샘플링 + JPEG 압축한다. 원본 URI는 임시 참조일 수 있어(피커가
     * 반환한 캐시 URI 등), 위젯 프로세스가 항상 접근 가능한 앱 전용 저장소에 안정적으로 보관해야 한다.
     */
    private fun processAndStoreBackgroundImage(sourceUriString: String): String {
        val uri = sourceUriString.toUri()
        val sampledBitmap = decodeSampledBitmap(uri, MAX_BACKGROUND_DIMENSION_PX)
            ?: throw IllegalStateException("Unable to decode background image: $sourceUriString")
        // BitmapFactory.decodeStream()은 EXIF Orientation 태그를 무시하고 저장된 픽셀 그대로
        // 디코딩한다([ISSUE-255]) — 여기서 방향을 픽셀에 직접 구워 넣어야, 이후 위젯이 이 파일을
        // BitmapFactory.decodeFile()로 다시 읽을 때도(방향 정보 없이) 항상 올바르게 보인다.
        val bitmap = applyExifOrientation(sampledBitmap, readExifOrientation(uri))
        val outFile = newBackgroundImageFile()
        try {
            FileOutputStream(outFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, BACKGROUND_JPEG_QUALITY, out)
            }
        } finally {
            bitmap.recycle()
        }
        return outFile.absolutePath
    }

    private fun readExifOrientation(uri: Uri): Int =
        try {
            openUriInputStream(uri)?.use { stream ->
                ExifInterface(stream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            } ?: ExifInterface.ORIENTATION_NORMAL
        } catch (e: Exception) {
            ExifInterface.ORIENTATION_NORMAL
        }

    /**
     * [orientation](ExifInterface.TAG_ORIENTATION 값)에 맞춰 [bitmap]을 회전/반전한 새 비트맵을
     * 반환한다. 방향 보정이 필요 없으면(NORMAL/UNDEFINED 등 매핑되지 않는 값) 원본을 그대로 반환.
     */
    private fun applyExifOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                matrix.postRotate(90f)
                matrix.postScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                matrix.postRotate(270f)
                matrix.postScale(-1f, 1f)
            }
            else -> return bitmap
        }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated !== bitmap) bitmap.recycle()
        return rotated
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
