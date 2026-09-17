import { Sermon } from '../types/Sermon';
import { QT } from '../types/QT';
import { isoWeekFromDateString } from './isoWeek';
import { NoteIdentity } from './meditationNoteGuard';

/**
 * 묵상 메모가 "어떤 말씀에 대해 쓰인 것인지"를 나타내는 식별자.
 * video_url은 절대 포함하지 않는다 — video_url만 채워지는 갱신으로 같은 문서가 다시 내려와도
 * 새 말씀으로 취급하면 안 된다(테스터 피드백).
 *
 * - sermons-v2(주간 데이터, `week` 있음): `week_worship_type`이 다르면 다른 예배 → 무조건 삭제.
 *   같은 예배 슬롯이 갱신된 것뿐이므로 애매한 경우가 없어 secondary는 두지 않는다.
 * - legacy 'sermons'(`week` 없음 — '전체' 옵션, 혹은 아직 weekly 캐시가 없어 레거시로 폴백한 경우):
 *   `week` 필드가 없으므로 date로부터 ISO 8601 week을 역산해 primary로 쓴다. ISO week이 같으면
 *   1차로는 유지하되, 문서 id(secondary)가 실제로 바뀌었으면(다른 예배 콘텐츠로 교체된 것일 수
 *   있음) 자동 삭제 대신 배너로 확인한다.
 */
export function sermonNoteIdentity(sermon: Sermon | null): NoteIdentity | null {
  if (!sermon) return null;
  if (sermon.week) {
    return { primary: `${sermon.week}_${sermon.worship_type ?? ''}` };
  }
  const week = isoWeekFromDateString(sermon.date);
  return week ? { primary: week, secondary: sermon.id } : null;
}

/** QT는 날짜만 다르면 무조건 삭제해도 된다는 것이 기획 확정이라 secondary(배너)가 필요 없다. */
export function qtNoteIdentity(qt: QT | null): NoteIdentity | null {
  if (!qt) return null;
  return { primary: qt.date };
}
