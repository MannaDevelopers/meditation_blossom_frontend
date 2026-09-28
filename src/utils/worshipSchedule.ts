import { Sermon, WorshipType } from '../types/Sermon';

// 각 예배의 요일(ISO weekday: 월=1 ... 일=7)/시각. src/types/Sermon.ts의 WORSHIP_TYPES 라벨과 1:1 대응.
// Android WorshipSchedule.kt / iOS WorshipSermonSync.swift와 반드시 동일하게 유지해야 한다([ISSUE-315]).
export const WORSHIP_SCHEDULE: Record<WorshipType, { isoWeekday: number; hour: number; minute: number }> = {
  SAT_1700: { isoWeekday: 6, hour: 17, minute: 0 },
  SUN_0950: { isoWeekday: 7, hour: 9, minute: 50 },
  SUN_1150: { isoWeekday: 7, hour: 11, minute: 50 },
  SUN_1430: { isoWeekday: 7, hour: 14, minute: 30 },
};

/**
 * ISO 8601 week string("2026-W37")이 가리키는 주의 월요일 0시(로컬 타임존)를 반환.
 * 형식이 올바르지 않으면 null. ISO 8601 규칙: 해당 연도 1월 4일은 항상 1주차에 속한다.
 */
export function resolveIsoWeekMonday(week: string): Date | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const weekNumber = parseInt(match[2], 10);
  if (weekNumber < 1 || weekNumber > 53) return null;

  const jan4 = new Date(year, 0, 4);
  const jan4Weekday = jan4.getDay() === 0 ? 7 : jan4.getDay(); // 일요일(0) -> 7
  const week1Monday = new Date(year, 0, 4 - (jan4Weekday - 1));

  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** week + worshipType이 가리키는 실제 예배 시작 시각(로컬 타임존). 계산할 수 없으면 null. */
export function resolveWorshipDateTime(week: string, worshipType: WorshipType): Date | null {
  const monday = resolveIsoWeekMonday(week);
  const schedule = WORSHIP_SCHEDULE[worshipType];
  if (!monday || !schedule) return null;

  const result = new Date(monday);
  result.setDate(monday.getDate() + (schedule.isoWeekday - 1));
  result.setHours(schedule.hour, schedule.minute, 0, 0);
  return result;
}

/**
 * week/worshipType이 가리키는 예배 시각에 현재 시각(now)이 이미 도달했는지 판별한다([ISSUE-315]).
 * FCM은 예배 시각보다 훨씬 먼저(주보 등록 시점) 도착하므로, 실제 예배가 시작되기 전까지는
 * 화면/위젯에 반영되면 안 된다.
 * week/worshipType 조합을 해석할 수 없으면(방어적으로) true를 반환한다 — 판별 불가한 데이터를
 * 영원히 숨기는 것보다, 기존 동작(즉시 반영)으로 안전하게 폴백하는 쪽을 택한다.
 */
export function hasWorshipTimeArrived(
  week: string | undefined,
  worshipType: WorshipType | undefined,
  now: Date = new Date(),
): boolean {
  if (!week || !worshipType) return true;
  const scheduled = resolveWorshipDateTime(week, worshipType);
  if (!scheduled) return true;
  return now.getTime() >= scheduled.getTime();
}

/**
 * weekly_sermons 캐시에서 사용자 설정에 맞는 문서를 찾아도, 그 예배 시각이 아직 안 됐으면
 * currentlyDisplayed(이미 화면/위젯에 보이던 콘텐츠)를 그대로 반환한다([ISSUE-315]).
 * FCM은 실제 예배 시각보다 훨씬 먼저(주보 등록 시점) 도착하므로, 시각이 되기 전에는
 * 절대 새 콘텐츠를 노출하지 않아야 한다. '전체' 설정은 이 함수의 대상이 아니다
 * (호출자가 레거시 sermon_events(_v2) 경로로 별도 처리한다).
 */
export function selectGatedWeeklySermon(
  weeklySermons: Sermon[],
  worshipType: WorshipType,
  currentlyDisplayed: Sermon | null,
  now: Date = new Date(),
): Sermon | null {
  const candidate = weeklySermons.find(s => s.worship_type === worshipType) || null;
  if (!candidate) return currentlyDisplayed;
  // 화면/위젯에 이미 뭔가 보여주고 있었다면(일반적인 경우) 시각이 될 때까지 그걸 유지한다.
  // 아무것도 보여준 적이 없다면(최초 설치, 막 업데이트한 사용자가 예배시간을 처음 설정한 경우
  // 등) 완전히 빈 화면보다는 조금 이르더라도 후보를 보여주는 쪽을 택한다(의도적 예외).
  if (currentlyDisplayed && !hasWorshipTimeArrived(candidate.week, candidate.worship_type, now)) {
    return currentlyDisplayed;
  }
  return candidate;
}
