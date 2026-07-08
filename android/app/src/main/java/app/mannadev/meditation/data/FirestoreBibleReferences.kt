package app.mannadev.meditation.data

import app.mannadev.meditation.analytics.CrashlyticsHelper
import app.mannadev.meditation.model.BibleReferenceResolver
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.put
import timber.log.Timber

/**
 * 위젯 단독 설치 등으로 prefs가 비어있을 때, 네이티브 Firestore 조회 결과로부터 본문(content)을 만든다.
 *
 * `bible_references`(book/chapter/verse_start/verse_end 필드를 가진 배열; FCM data payload에서
 * [BibleReferenceResolver.resolveBibleReferencesJson]이 받는 JSON과 동일한 스키마)로부터 앱에 내장된
 * Bible DB를 이용해 재구성하는 것을 최우선으로 한다. Firestore의 `content` 필드는 캐시성 편의 필드라
 * 스키마에서 나중에 사라질 수 있으므로, `bible_references`가 없거나 재구성에 실패했을 때만 fallback으로
 * 사용한다.
 */
internal fun resolveFirestoreContent(
    resolver: BibleReferenceResolver,
    data: Map<String, Any?>,
): String {
    val existingContent = (data["content"] as? String).orEmpty()

    @Suppress("UNCHECKED_CAST")
    val bibleReferences = data["bible_references"] as? List<Map<String, Any?>>
    if (bibleReferences.isNullOrEmpty()) return existingContent

    return try {
        resolver.resolveBibleReferencesJson(bibleReferencesToJson(bibleReferences))
    } catch (e: Exception) {
        Timber.w(e, "resolveFirestoreContent: bible_references 변환 실패, content 필드로 대체")
        // Crashlytics 기록 자체가 실패해도(예: 초기화 전) 원래 흐름을 막지 않는다.
        runCatching {
            CrashlyticsHelper.recordException(e, "resolveFirestoreContent: bible_references 변환 실패")
        }
        existingContent
    }
}

private fun bibleReferencesToJson(bibleReferences: List<Map<String, Any?>>): String {
    val array = buildJsonArray {
        bibleReferences.forEach { ref ->
            addJsonObject {
                put("book", ref["book"] as? String)
                put("chapter", (ref["chapter"] as? Number)?.toInt())
                put("verse_start", (ref["verse_start"] as? Number)?.toInt())
                put("verse_end", (ref["verse_end"] as? Number)?.toInt())
            }
        }
    }
    return array.toString()
}
