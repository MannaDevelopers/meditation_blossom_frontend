package app.mannadev.meditation.bible

import app.mannadev.meditation.data.bible.BibleBookAlias
import app.mannadev.meditation.data.bible.BookAliasNotFoundException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BibleBookAliasTest {

    @Test fun `tier1 exact map resolves known standard names`() {
        assertEquals("창세기", BibleBookAlias.resolve("창세기"))
        assertEquals("요한1서", BibleBookAlias.resolve("요한1서"))
        assertEquals("고린도전서", BibleBookAlias.resolve("고린도전서"))
    }

    @Test fun `tier1 exact map resolves common hangul number variants`() {
        assertEquals("요한1서", BibleBookAlias.resolve("요한일서"))
        assertEquals("요한2서", BibleBookAlias.resolve("요한이서"))
        assertEquals("요한3서", BibleBookAlias.resolve("요한삼서"))
    }

    @Test fun `tier1 exact map resolves compact variants`() {
        assertEquals("요한1서", BibleBookAlias.resolve("1요한"))
        assertEquals("요한1서", BibleBookAlias.resolve("요1"))
    }

    @Test fun `unknown input throws`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            BibleBookAlias.resolve("이상한책명")
        }
    }

    @Test fun `tier2 strips whitespace and punctuation`() {
        assertEquals("요한1서", BibleBookAlias.resolve("  요한 1 서  "))
        assertEquals("요한1서", BibleBookAlias.resolve("요한.1서"))
        assertEquals("로마서", BibleBookAlias.resolve("(로마서)"))
    }

    @Test fun `tier2 converts hangul digits to arabic for john epistles`() {
        assertEquals("요한1서", BibleBookAlias.resolve("요한 일 서"))
    }

    @Test fun `tier2 appends missing suffix`() {
        // KorNRV는 "로마서"/"요한복음" 등 접미사를 사용. "로마"만 왔을 때도 해석
        assertEquals("로마서", BibleBookAlias.resolve("로마"))
        assertEquals("요한복음", BibleBookAlias.resolve("요한"))  // 주의: "요한"만 단독은 복음으로 해석
    }

    @Test fun `tier3 fuzzy matches single-char typo`() {
        // "로마서" → "노마서" (ㄹ→ㄴ, 1자 오타)
        assertEquals("로마서", BibleBookAlias.resolve("노마서"))
        // "요한복음" → "요환복음" (ㅏ→ㅘ)
        assertEquals("요한복음", BibleBookAlias.resolve("요환복음"))
    }

    @Test fun `tier3 rejects too-distant input`() {
        assertThrows(BookAliasNotFoundException::class.java) {
            BibleBookAlias.resolve("이건전혀다른이름입니다")
        }
    }
}
