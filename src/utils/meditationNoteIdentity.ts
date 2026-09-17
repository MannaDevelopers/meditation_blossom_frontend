import { Sermon } from '../types/Sermon';
import { QT } from '../types/QT';
import { isoWeekFromDateString } from './isoWeek';
import { NoteIdentity } from './meditationNoteGuard';

/**
 * 묵상 메모가 "어떤 주의 말씀에 대해 쓰인 것인지"를 나타내는 식별자.
 *
 * primary는 항상 week(ISO 8601)만 본다 — worship_type/video_url은 포함하지 않는다.
 * 그래서:
 * - 예배시간 설정을 바꿔서 같은 주의 다른 예배 콘텐츠가 표시돼도(설정 화면 피드백) 지워지지
 *   않는다. worship_type이 달라져도 primary(week)는 그대로이기 때문이다.
 * - video_url만 채워지는 갱신도 당연히 유지된다(week가 안 바뀌므로).
 * - week가 실제로 넘어간 경우(진짜 새 말씀)만 onMismatch가 적용되는데, 말씀은 확신할 수
 *   없으니 자동 삭제 대신 배너로 확인한다.
 *
 * sermons-v2 문서엔 `week`가 그대로 있고, legacy 'sermons'(전체 옵션, 혹은 아직 weekly
 * 캐시가 없어 폴백한 경우)엔 그 필드가 없어 date로부터 ISO 8601 week을 역산한다.
 */
export function sermonNoteIdentity(sermon: Sermon | null): NoteIdentity | null {
  if (!sermon) return null;
  const week = sermon.week || isoWeekFromDateString(sermon.date);
  return week ? { primary: week, onMismatch: 'confirm_clear' } : null;
}

/** QT는 날짜만 다르면 물어볼 것 없이 바로 지운다는 것이 기획 확정이다. */
export function qtNoteIdentity(qt: QT | null): NoteIdentity | null {
  if (!qt) return null;
  return { primary: qt.date, onMismatch: 'auto_clear' };
}
