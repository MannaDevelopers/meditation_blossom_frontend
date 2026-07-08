package app.mannadev.meditation.data

import app.mannadev.meditation.model.BibleReferenceResolver
import org.json.JSONArray
import org.json.JSONObject
import timber.log.Timber

/**
 * 위젯 단독 설치 등으로 prefs가 비어있을 때, 네이티브 Firestore 조회 결과로부터 본문(content)을 만든다.
 * Firestore 문서는 `bible_references`를 book/chapter/verse_start/verse_end 필드를 가진 배열로 저장하는데,
 * 이는 FCM data payload에서 [BibleReferenceResolver.resolveBibleReferencesJson]이 받는 JSON 문자열과
 * 동일한 스키마이므로, 재직렬화만 해서 그대로 재사용한다.
 */
internal fun resolveFirestoreContent(
    resolver: BibleReferenceResolver,
    data: Map<String, Any?>,
): String {
    val fallback = data["content"] as? String ?: ""
    @Suppress("UNCHECKED_CAST")
    val bibleReferences = data["bible_references"] as? List<Map<String, Any?>>
    if (bibleReferences.isNullOrEmpty()) return fallback

    return try {
        resolver.resolveBibleReferencesJson(bibleReferencesToJson(bibleReferences))
    } catch (e: Exception) {
        Timber.w(e, "resolveFirestoreContent: bible_references 변환 실패, content 비움")
        ""
    }
}

private fun bibleReferencesToJson(bibleReferences: List<Map<String, Any?>>): String {
    val array = JSONArray()
    bibleReferences.forEach { ref ->
        array.put(
            JSONObject().apply {
                put("book", ref["book"])
                put("chapter", ref["chapter"])
                put("verse_start", ref["verse_start"])
                put("verse_end", ref["verse_end"])
            },
        )
    }
    return array.toString()
}
