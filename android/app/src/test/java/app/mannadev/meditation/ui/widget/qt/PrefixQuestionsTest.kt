package app.mannadev.meditation.ui.widget.qt

import org.junit.Assert.assertEquals
import org.junit.Test

class PrefixQuestionsTest {

    @Test
    fun `single question uses asterisk prefix`() {
        val questions = listOf("하나님이 보이지 않을 때 나의 시선은 어디를 향합니까?")
        val result = prefixQuestions(questions)
        assertEquals(listOf("* 하나님이 보이지 않을 때 나의 시선은 어디를 향합니까?"), result)
    }

    @Test
    fun `multiple questions use numbered prefix`() {
        val questions = listOf(
            "하나님이 보이지 않을 때 나의 시선은 어디를 향합니까?",
            "❶ 나의 필요와 욕망이 채워지지 않아도 주로 인해 기뻐할 수 있습니까?",
            "❷ 모든 것을 잃어도 하나님의 사랑과 구원으로 다시 시작할 수 있습니까?",
        )
        val result = prefixQuestions(questions)
        assertEquals(
            listOf(
                "1. 하나님이 보이지 않을 때 나의 시선은 어디를 향합니까?",
                "2. ❶ 나의 필요와 욕망이 채워지지 않아도 주로 인해 기뻐할 수 있습니까?",
                "3. ❷ 모든 것을 잃어도 하나님의 사랑과 구원으로 다시 시작할 수 있습니까?",
            ),
            result,
        )
    }

    @Test
    fun `empty list returns empty list`() {
        assertEquals(emptyList<String>(), prefixQuestions(emptyList()))
    }
}
