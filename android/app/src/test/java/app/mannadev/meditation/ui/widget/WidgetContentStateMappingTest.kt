package app.mannadev.meditation.ui.widget

import app.mannadev.meditation.dto.QtDto
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.widget.state.WidgetContentState
import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetContentStateMappingTest {

    private val sampleSermon = Sermon(verses = listOf("본문"), bookName = "마태복음", title = "제목")

    @Test fun `Sermon Data는 그대로 보여준다`() {
        val result = WidgetContentState.Data(sampleSermon).toDisplaySermon()
        assertEquals(sampleSermon, result)
    }

    @Test fun `Sermon Loading과 NoDataYet은 최초 실행 안내를 보여준다`() {
        assertEquals(Sermon.noData, WidgetContentState.Loading.toDisplaySermon())
        assertEquals(Sermon.noData, WidgetContentState.NoDataYet.toDisplaySermon())
    }

    @Test fun `Sermon Error는 새로고침 유도 문구를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplaySermon()
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

    @Test fun `Qt Data는 fromDto로 변환해서 보여준다`() {
        val result = WidgetContentState.Data(sampleQt).toDisplayQtUiModel()
        assertEquals("제목", result.title)
    }

    @Test fun `Qt Loading과 NoDataYet은 최초 실행 안내를 보여준다`() {
        assertEquals("QT 위젯 설치 완료!", WidgetContentState.Loading.toDisplayQtUiModel().title)
        assertEquals("QT 위젯 설치 완료!", WidgetContentState.NoDataYet.toDisplayQtUiModel().title)
    }

    @Test fun `Qt Error는 새로고침 유도 문구를 보여준다`() {
        val result = WidgetContentState.Error(RuntimeException("boom")).toDisplayQtUiModel()
        assertEquals("QT를 불러오지 못했습니다", result.title)
    }
}
