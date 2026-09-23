package app.mannadev.meditation.data

import kotlinx.serialization.json.Json

/**
 * JS `user_worship_setting`(예배시간 설정)을 네이티브에서 해석하기 위한 순수 로직([#307]).
 *
 * 앱이 완전히 종료돼 JS가 없을 때도 FCM 처리 결과가 JS(`useFCMListener`)와 같아야 하므로,
 * 키/기본값/판단 규칙을 JS(`src/types/Sermon.ts`)와 동일하게 유지한다. 변경 시 양쪽을 같이 고쳐야 한다.
 */
object WorshipSetting {

    /** JS `USER_WORSHIP_SETTING_KEY` — 값은 JSON이 아닌 원시 문자열("SUN_1150", "ALL" 등)로 저장된다. */
    const val ASYNC_STORAGE_KEY = "user_worship_setting"

    /** JS `WorshipSetting`의 '전체' 옵션 — 레거시 `sermons` 컬렉션 단일 최신 문서를 보여준다. */
    const val ALL = "ALL"

    /** JS `DEFAULT_WORSHIP_TYPE` — 설정이 한 번도 저장되지 않았을 때의 기본값. */
    const val DEFAULT_WORSHIP_TYPE = "SUN_0950"

    /** JS `LEGACY_SERMON_CACHE_KEY` — '전체' 옵션용 레거시 최신 문서 전용 캐시. */
    const val ASYNC_STORAGE_LEGACY_SERMON_CACHE = "legacy_sermon_cache"

    private const val KEY_ID = "id"
    private const val KEY_SOURCE_ID = "source_id"

    /** AsyncStorage 원시값 → 실제 설정. 없으면 JS와 동일하게 [DEFAULT_WORSHIP_TYPE]. */
    fun resolve(stored: String?): String = stored?.takeIf { it.isNotEmpty() } ?: DEFAULT_WORSHIP_TYPE

    /** 레거시 sermon_events(_v2)가 위젯/'지금 화면' 슬롯에 반영돼야 하는 설정인지('전체'일 때만). */
    fun isAll(stored: String?): Boolean = resolve(stored) == ALL

    /**
     * 레거시 FCM payload(본문 해석 완료)를 [ASYNC_STORAGE_LEGACY_SERMON_CACHE]에 저장할 JSON으로 만든다.
     * JS는 이 값을 `fcmDataToSermon`으로 읽는데 레거시 payload엔 id가 없으므로, JS `sermonFromLegacyEvent`와
     * 동일하게 source_id를 id로 채운다.
     */
    fun legacyCacheJson(dataWithResolvedContent: Map<String, String>): String {
        val withId = if (dataWithResolvedContent[KEY_ID].isNullOrEmpty()) {
            dataWithResolvedContent + (KEY_ID to dataWithResolvedContent[KEY_SOURCE_ID].orEmpty())
        } else {
            dataWithResolvedContent
        }
        return Json.encodeToString(withId)
    }
}
