package app.mannadev.meditation.model

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.Constants
import app.mannadev.meditation.dto.SermonDto
import timber.log.Timber

data class Sermon(
    val verses: List<String>, // 말씀 내용 (예: "또 비유로 말씀하시되...")
    val bookName: String, // 성경 책 이름 (예: "마태복음")
    val title: String, //설교 제목
    val videoUrl: String? = null,
) {
    companion object Companion {

        /** 데이터는 받았지만(parse 실패 등) 표시할 수 없을 때의 공통 에러 표시. */
        val errorSermon = Sermon(
            verses = listOf(Constants.WIDGET_ERROR_GUIDE_MESSAGE),
            title = "말씀을 불러오지 못했습니다",
            bookName = ""
        )

        /** prefs/Firestore 어디서도 데이터를 아직 한 번도 동기화하지 못했을 때 사용하는 최초 실행 안내. */
        val noData: Sermon = Sermon(
            verses = listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE),
            title = "말씀 위젯 설치 완료!",
            bookName = "",
        )

        fun fromDto(dto: SermonDto): Sermon =
            try {
                VerseParser.parse(dto)
            } catch (e: Exception) {
                Timber.e(e, "Sermon.fromDto failed for dto: $dto")
                CrashlyticsHelper.recordException(e, "Sermon.fromDto parsing failed")
                errorSermon
            }
    }
}
