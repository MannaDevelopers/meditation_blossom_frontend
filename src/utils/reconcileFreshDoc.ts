/**
 * Firestore onSnapshot으로 도착한 fresh 문서를 현재(current)와 비교해
 * 화면/AsyncStorage에 반영할 문서를 결정한다.
 *
 * - fresh가 더 최신(compare > 0)이면 fresh로 통째 교체 (서버가 canonical)
 * - 같은 날짜(같은 항목)인데 current에 content/video_url이 비어 있으면 fresh 값으로만 보충(머지)
 *   → 구 캐시 / FCM 페이로드가 video_url을 누락한 경우를 보정한다.
 *     단 fresh에도 없으면 채우지 않으므로, 영상이 원래 없는 항목에서 불필요한 갱신/루프가 없다.
 *   → 머지는 빈 칸만 채우고 기존 값은 보존하므로, FCM이 먼저 들고 온 필드를 덮지 않는다.
 * - 반영할 변화가 없으면 null
 *
 * Sermon, QT 양쪽 onSnapshot에서 동일하게 사용해 두 화면 동작을 통일한다.
 */
export function reconcileFreshDoc<
  T extends { date: string; content: string; video_url?: string },
>(
  fresh: T,
  current: T | null,
  compare: (a: T | null, b: T | null) => number,
): T | null {
  if (compare(fresh, current) > 0) return fresh;
  if (!current || fresh.date !== current.date) return null;

  const merged: T = {
    ...current,
    content: current.content || fresh.content,
    video_url: current.video_url || fresh.video_url,
  };
  const changed =
    merged.content !== current.content || merged.video_url !== current.video_url;
  return changed ? merged : null;
}
