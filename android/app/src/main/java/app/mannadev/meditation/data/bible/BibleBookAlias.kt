package app.mannadev.meditation.data.bible

/**
 * 입력된 책 이름을 KorNRV 표준 표기(`books.name`)로 해석한다.
 *
 * 해석 순서:
 *   Tier 1: ExactMap (이 파일)
 *   Tier 2: 규칙 기반 정규화 (Task 5)
 *   Tier 3: 한글 자모 기반 fuzzy match (Task 6)
 *
 * 어떤 Tier도 매치하지 못하면 [BookAliasNotFoundException].
 */
object BibleBookAlias {

    /** KorNRV 66권 표준 표기. Tier 3 candidate 및 정답 검증에 사용. */
    val STANDARD_NAMES: List<String> = listOf(
        "창세기", "출애굽기", "레위기", "민수기", "신명기",
        "여호수아", "사사기", "룻기",
        "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하",
        "에스라", "느헤미야", "에스더",
        "욥기", "시편", "잠언", "전도서", "아가",
        "이사야", "예레미야", "예레미야애가", "에스겔", "다니엘",
        "호세아", "요엘", "아모스", "오바댜", "요나", "미가",
        "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기",
        "마태복음", "마가복음", "누가복음", "요한복음",
        "사도행전", "로마서",
        "고린도전서", "고린도후서", "갈라디아서", "에베소서", "빌립보서", "골로새서",
        "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "디도서", "빌레몬서",
        "히브리서", "야고보서", "베드로전서", "베드로후서",
        "요한1서", "요한2서", "요한3서",
        "유다서", "요한계시록",
    )

    private val standardSet: Set<String> = STANDARD_NAMES.toSet()

    private val exactMap: Map<String, String> = buildMap {
        // 표준명 그대로
        STANDARD_NAMES.forEach { put(it, it) }
        // 한글 숫자 ↔ 아라비아 숫자 (요한1/2/3서는 KorNRV가 아라비아)
        put("요한일서", "요한1서"); put("요한이서", "요한2서"); put("요한삼서", "요한3서")
        // 전/후 ↔ 일/이 (고린도·데살로니가·디모데·베드로 등)
        put("고린도일서", "고린도전서"); put("고린도이서", "고린도후서")
        put("데살로니가일서", "데살로니가전서"); put("데살로니가이서", "데살로니가후서")
        put("디모데일서", "디모데전서"); put("디모데이서", "디모데후서")
        put("베드로일서", "베드로전서"); put("베드로이서", "베드로후서")
        // 1요한/2요한 같은 숫자 접두 표기
        put("1요한", "요한1서"); put("2요한", "요한2서"); put("3요한", "요한3서")
        put("1고린도", "고린도전서"); put("2고린도", "고린도후서")
        put("1데살로니가", "데살로니가전서"); put("2데살로니가", "데살로니가후서")
        put("1디모데", "디모데전서"); put("2디모데", "디모데후서")
        put("1베드로", "베드로전서"); put("2베드로", "베드로후서")
        put("1사무엘", "사무엘상"); put("2사무엘", "사무엘하")
        put("1열왕기", "열왕기상"); put("2열왕기", "열왕기하")
        put("1역대", "역대상"); put("2역대", "역대하")
        // 초단축 표기
        put("요1", "요한1서"); put("요2", "요한2서"); put("요3", "요한3서")
    }

    fun resolve(input: String): String {
        exactMap[input]?.let { return it }

        val normalized = normalizeForTier2(input)
        exactMap[normalized]?.let { return it }

        // 접미사 보완: "로마" → "로마서", "요한" → "요한복음"
        for (suffix in listOf("서", "복음", "기", "상", "하", "계시록")) {
            val candidate = normalized + suffix
            exactMap[candidate]?.let { return it }
        }

        tier3Fuzzy(normalized)?.let { return it }

        throw BookAliasNotFoundException(input)
    }

    internal fun isStandard(name: String): Boolean = name in standardSet

    private fun normalizeForTier2(raw: String): String {
        val stripped = raw.replace(WHITESPACE_OR_PUNCT, "")
        return HANGUL_DIGIT_REPLACE.entries.fold(stripped) { acc, (k, v) -> acc.replace(k, v) }
    }

    private val WHITESPACE_OR_PUNCT = Regex("[\\s.,()\\[\\]<>\\-_/]")
    private val HANGUL_DIGIT_REPLACE: Map<String, String> = mapOf(
        "일" to "1", "이" to "2", "삼" to "3", "사" to "4",
    )

    private const val FUZZY_MAX_DISTANCE = 2

    internal fun tier3Fuzzy(normalizedInput: String): String? {
        val inputJamo = toJamoSequence(normalizedInput)
        var bestName: String? = null
        var bestDistance = Int.MAX_VALUE
        for (name in STANDARD_NAMES) {
            val candidateJamo = toJamoSequence(name)
            val d = levenshtein(inputJamo, candidateJamo, upperBound = FUZZY_MAX_DISTANCE)
            if (d < bestDistance) {
                bestDistance = d
                bestName = name
                if (d == 0) break
            }
        }
        return if (bestDistance <= FUZZY_MAX_DISTANCE) bestName else null
    }

    /** 한글 음절(AC00-D7A3)을 초/중/종성 자모로 분해. 그 외 문자는 그대로 1원소. */
    internal fun toJamoSequence(s: String): IntArray {
        val out = IntArray(s.length * 3)
        var idx = 0
        for (ch in s) {
            val code = ch.code
            if (code in 0xAC00..0xD7A3) {
                val base = code - 0xAC00
                val cho = base / (21 * 28)                  // 0..18
                val jung = (base % (21 * 28)) / 28          // 0..20
                val jong = base % 28                        // 0..27 (0 = 종성 없음)
                out[idx++] = 0x1100 + cho
                out[idx++] = 0x1161 + jung
                if (jong != 0) out[idx++] = 0x11A7 + jong
            } else {
                out[idx++] = code
            }
        }
        return out.copyOf(idx)
    }

    /** 표준 Levenshtein. upperBound 초과가 확정되면 Int.MAX_VALUE 반환(조기 종료). */
    internal fun levenshtein(a: IntArray, b: IntArray, upperBound: Int): Int {
        val n = a.size; val m = b.size
        if (kotlin.math.abs(n - m) > upperBound) return Int.MAX_VALUE
        if (n == 0) return m
        if (m == 0) return n
        val prev = IntArray(m + 1) { it }
        val curr = IntArray(m + 1)
        for (i in 1..n) {
            curr[0] = i
            var rowMin = curr[0]
            for (j in 1..m) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                curr[j] = minOf(
                    prev[j] + 1,        // deletion
                    curr[j - 1] + 1,    // insertion
                    prev[j - 1] + cost, // substitution
                )
                if (curr[j] < rowMin) rowMin = curr[j]
            }
            if (rowMin > upperBound) return Int.MAX_VALUE
            System.arraycopy(curr, 0, prev, 0, m + 1)
        }
        return prev[m]
    }
}
