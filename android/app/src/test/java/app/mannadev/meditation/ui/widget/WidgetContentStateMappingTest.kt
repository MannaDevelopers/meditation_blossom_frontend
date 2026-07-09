package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState
import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetContentStateMappingTest {

    private val sampleSermon = Sermon(verses = listOf("본문"), bookName = "마태복음", title = "제목")

    @Test fun `Sermon Data는 hasAppEverLaunched와 무관하게 그대로 보여준다`() {
        assertEquals(sampleSermon, WidgetContentState.Data(sampleSermon).toDisplaySermon(true))
        assertEquals(sampleSermon, WidgetContentState.Data(sampleSermon).toDisplaySermon(false))
    }

    @Test fun `Sermon Loading은 hasAppEverLaunched와 무관하게 최초 실행 안내를 보여준다`() {
        assertEquals(Sermon.noData, WidgetContentState.Loading.toDisplaySermon(true))
        assertEquals(Sermon.noData, WidgetContentState.Loading.toDisplaySermon(false))
    }

    @Test fun `Sermon NoDataYet은 앱을 실행한 적 없으면 최초 실행 안내를 보여준다`() {
        assertEquals(Sermon.noData, WidgetContentState.NoDataYet.toDisplaySermon(false))
    }

    @Test fun `Sermon NoDataYet은 앱을 실행한 적 있으면 새로고침 유도 문구를 보여준다`() {
        assertEquals(Sermon.errorSermon, WidgetContentState.NoDataYet.toDisplaySermon(true))
    }

    @Test fun `Sermon Error는 앱을 실행한 적 없으면 최초 실행 안내를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplaySermon(false)
        assertEquals(Sermon.noData, result)
    }

    @Test fun `Sermon Error는 앱을 실행한 적 있으면 새로고침 유도 문구를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplaySermon(true)
        assertEquals(Sermon.errorSermon, result)
    }

    private val sampleQt = QtDto(
        date = "2026-07-09",
        title = "제목",
        seriesTitle = "",
        content = "본문",
        dayOfWeek = "THU",
        videoUrl = null,
        meditationQuestions = emptyList(),
    )

    @Test fun `Qt Data는 hasAppEverLaunched와 무관하게 fromDto로 변환해서 보여준다`() {
        assertEquals("제목", WidgetContentState.Data(sampleQt).toDisplayQtUiModel(true).title)
        assertEquals("제목", WidgetContentState.Data(sampleQt).toDisplayQtUiModel(false).title)
    }

    @Test fun `Qt Loading은 hasAppEverLaunched와 무관하게 최초 실행 안내를 보여준다`() {
        assertEquals("QT 위젯 설치 완료!", WidgetContentState.Loading.toDisplayQtUiModel(true).title)
        assertEquals("QT 위젯 설치 완료!", WidgetContentState.Loading.toDisplayQtUiModel(false).title)
    }

    @Test fun `Qt NoDataYet은 앱을 실행한 적 없으면 최초 실행 안내를 보여준다`() {
        assertEquals("QT 위젯 설치 완료!", WidgetContentState.NoDataYet.toDisplayQtUiModel(false).title)
    }

    @Test fun `Qt NoDataYet은 앱을 실행한 적 있으면 새로고침 유도 문구를 보여준다`() {
        assertEquals("QT를 불러오지 못했습니다", WidgetContentState.NoDataYet.toDisplayQtUiModel(true).title)
    }

    @Test fun `Qt Error는 앱을 실행한 적 없으면 최초 실행 안내를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplayQtUiModel(false)
        assertEquals("QT 위젯 설치 완료!", result.title)
    }

    @Test fun `Qt Error는 앱을 실행한 적 있으면 새로고침 유도 문구를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplayQtUiModel(true)
        assertEquals("QT를 불러오지 못했습니다", result.title)
    }
}
