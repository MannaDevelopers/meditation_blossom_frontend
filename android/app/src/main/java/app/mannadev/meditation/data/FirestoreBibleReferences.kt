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
 * Firestore 문서(예: `sermons` 컬렉션)는 이미 완전히 해석된 "본문 : ..." 형식의 `content` 필드를
 * 갖고 있는 경우가 많으므로 이를 최우선으로 사용한다. `content`가 비어있는 문서(예: `qt` 컬렉션은
 * `content` 필드 자체가 없음)에 한해서만 `bible_references`(book/chapter/verse_start/verse_end 필드를
 * 가진 배열; FCM data payload에서 [BibleReferenceResolver.resolveBibleReferencesJson]이 받는 JSON과
 * 동일한 스키마)로부터 재구성을 시도한다.
 */
internal fun resolveFirestoreContent(
    resolver: BibleReferenceResolver,
    data: Map<String, Any?>,
): String {
    val existingContent = data["content"] as? String
    if (!existingContent.isNullOrBlank()) return existingContent

    @Suppress("UNCHECKED_CAST")
    val bibleReferences = data["bible_references"] as? List<Map<String, Any?>>
    if (bibleReferences.isNullOrEmpty()) return existingContent ?: ""

    return try {
        resolver.resolveBibleReferencesJson(bibleReferencesToJson(bibleReferences))
    } catch (e: Exception) {
        Timber.w(e, "resolveFirestoreContent: bible_references 변환 실패, content 비움")
        // Crashlytics 기록 자체가 실패해도(예: 초기화 전) 원래 흐름을 막지 않는다.
        runCatching {
            CrashlyticsHelper.recordException(e, "resolveFirestoreContent: bible_references 변환 실패")
        }
        ""
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
