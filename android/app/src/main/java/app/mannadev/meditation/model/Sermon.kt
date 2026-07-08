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
            verses = listOf("내용을 불러올 수 없습니다.", Constants.WIDGET_ERROR_GUIDE_MESSAGE),
            title = "",
            bookName = ""
        )

        /**
         * prefs/Firestore 어디서도 데이터를 전혀 못 가져왔을 때 사용한다.
         * @param hasAppEverLaunched false면 메인 앱을 한 번도 실행한 적이 없다는 뜻이므로
         * (아직 위젯이 활성화되지 않은 정상적인 상태) 안내 문구를, true면 (앱은 열었지만
         * 데이터를 못 가져온 진짜 에러) 새로고침 유도 문구를 보여준다.
         */
        fun noData(hasAppEverLaunched: Boolean): Sermon = if (hasAppEverLaunched) {
            errorSermon
        } else {
            Sermon(
                verses = listOf(Constants.WIDGET_FIRST_LAUNCH_GUIDE_MESSAGE),
                title = Constants.WIDGET_FIRST_LAUNCH_TITLE,
                bookName = "",
            )
        }

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

