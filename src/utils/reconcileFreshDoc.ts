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
  T extends {
    date: string;
    content: string;
    video_url?: string;
    series_title?: string;
    meditation_questions?: string;
  },
>(
  fresh: T,
  current: T | null,
  compare: (a: T | null, b: T | null) => number,
): T | null {
  if (!current) return fresh;

  // 다른 날짜: 더 최신 날짜 문서가 통째로 canonical (새 항목은 자체 데이터로 교체)
  if (fresh.date !== current.date) {
    return compare(fresh, current) > 0 ? fresh : null;
  }

  // 같은 날짜(같은 항목): updated_at이 더 최신이어도 통째 교체하지 않고 빈 칸만 보충한다.
  // 서버 qt 문서에 없는 FCM 전용 필드(meditation_questions, series_title)가 서버 snapshot
  // 도착 시 유실되는 것을 방지한다(#144). Sermon에는 없는 필드라 undefined로 무시됨.
  const merged: T = {
    ...current,
    content: current.content || fresh.content,
    video_url: current.video_url || fresh.video_url,
    series_title: current.series_title || fresh.series_title,
    meditation_questions: current.meditation_questions || fresh.meditation_questions,
  };
  const changed =
    merged.content !== current.content ||
    merged.video_url !== current.video_url ||
    merged.series_title !== current.series_title ||
    merged.meditation_questions !== current.meditation_questions;
  return changed ? merged : null;
}
