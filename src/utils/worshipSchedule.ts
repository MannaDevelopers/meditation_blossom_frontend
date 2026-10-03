import { Sermon, WorshipType } from '../types/Sermon';
import { toIsoWeek } from './isoWeek';

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
 * 지금(now) 기준으로 worshipType의 가장 가까운 미래 예배 시각을 반환한다([ISSUE-315]).
 * QA 도구(히든 개발자 메뉴의 가상 시각 오버라이드)가 "다음 예배 1분 전" 같은 값을
 * 계산할 때 쓴다. 이미 지난 시각이면 다음 주로 넘어간다.
 */
export function resolveNextWorshipDateTime(worshipType: WorshipType, now: Date = new Date()): Date {
  const currentWeek = toIsoWeek(now);
  const candidate = resolveWorshipDateTime(currentWeek, worshipType);
  if (candidate && candidate > now) return candidate;

  const nextWeekAnchor = new Date(now);
  nextWeekAnchor.setDate(now.getDate() + 7);
  const nextWeek = toIsoWeek(nextWeekAnchor);
  return resolveWorshipDateTime(nextWeek, worshipType) ?? nextWeekAnchor;
}

/**
 * weekly_sermons 캐시에 같은 worshipType이 여러 개(서로 다른 week) 있을 수 있다([ISSUE-315],
 * [ISSUE-329]) — 지난주 말씀을 다음 예배 시각까지 보여주려고 일부러 여러 주를 보관한다.
 * week가 더 최신인(사전식 비교로 충분 — "YYYY-Www" 포맷) 쪽을 앞에 둔 목록을 반환한다.
 */
function matchingWeeklySermonsNewestFirst(weeklySermons: Sermon[], worshipType: WorshipType): Sermon[] {
  return weeklySermons
    .filter(s => s.worship_type === worshipType)
    .sort((a, b) => {
      const aw = a.week ?? '';
      const bw = b.week ?? '';
      return aw === bw ? 0 : bw > aw ? 1 : -1;
    });
}

/** 같은 worshipType 중 week가 가장 최신인 항목(시각 도달 여부와 무관). 없으면 null. */
export function latestMatchingWeeklySermon(weeklySermons: Sermon[], worshipType: WorshipType): Sermon | null {
  return matchingWeeklySermonsNewestFirst(weeklySermons, worshipType)[0] ?? null;
}

/**
 * 캐시에 worshipType과 일치하면서 예배 시각이 이미 지난 항목이 하나라도 있는지([ISSUE-329]).
 * 없으면 "이 예배시간에서 지금 보여줄 말씀"을 캐시만으로는 알 수 없으므로 서버에서 지난주까지
 * 다시 가져와야 한다(syncSelectedSermonToWidget / loadLocalData의 서버 보충 판단 기준).
 */
export function hasArrivedWeeklySermon(weeklySermons: Sermon[], worshipType: WorshipType, now: Date = new Date()): boolean {
  return weeklySermons.some(s => s.worship_type === worshipType && hasWorshipTimeArrived(s.week, s.worship_type, now));
}

/**
 * weekly_sermons 캐시에서 사용자 설정(worshipType)에 맞는, "지금 화면/위젯에 보여야 할" 문서를 고른다.
 *
 * 같은 예배시간 항목 중 **예배 시각이 이미 지난 가장 최신 주** 항목이 정답이다
 * ([ISSUE-315], [ISSUE-329]). FCM/서버 문서는 예배 시각보다 훨씬 먼저(주보 등록 시점)
 * 도착하므로, 아직 시각이 안 된 이번 주 항목은 건너뛰고 지난주 항목을 보여주다가 시각이
 * 되는 순간 이번 주 항목으로 넘어간다.
 *
 * `currentlyDisplayed`(단일 슬롯)는 이 예배시간의 지난 콘텐츠를 모를 때만 쓰는 최후 폴백이다 —
 * 예배시간 옵션을 바꾸기 직전에 보던 *다른 예배시간*의 콘텐츠일 수 있으므로, 시각이 지난
 * 캐시 항목이 있으면 그쪽이 항상 우선한다(실사용자 리포트: 옵션 전환 시 이전 옵션 콘텐츠를
 * 물려받음). 폴백까지 없으면(최초 설치 등) 완전히 빈 화면보다는 조금 이르더라도 가장 최신
 * 후보를 보여준다(의도적 예외). '전체' 설정은 이 함수의 대상이 아니다(레거시 경로).
 */
export function selectGatedWeeklySermon(
  weeklySermons: Sermon[],
  worshipType: WorshipType,
  currentlyDisplayed: Sermon | null,
  now: Date = new Date(),
): Sermon | null {
  const matches = matchingWeeklySermonsNewestFirst(weeklySermons, worshipType);
  const arrived = matches.find(s => hasWorshipTimeArrived(s.week, s.worship_type, now));
  if (arrived) return arrived;
  return currentlyDisplayed ?? matches[0] ?? null;
}

// weekly_sermons 캐시에 보관할 최근 주 수. 이번 주(미도달) + 지난주(현재 표시) + 여유 1주.
export const WEEKLY_CACHE_MAX_WEEKS = 3;

/**
 * 캐시가 무한히 커지지 않도록 가장 최근 [WEEKLY_CACHE_MAX_WEEKS]개 주의 항목만 남긴다([ISSUE-329]).
 * week가 없는 항목은 주 단위로 정리할 수 없으므로 그대로 둔다(병합 키가 worship_type 하나로
 * 수렴해 무한히 늘지 않는다).
 */
export function pruneWeeklySermons(sermons: Sermon[], maxWeeks: number = WEEKLY_CACHE_MAX_WEEKS): Sermon[] {
  const keepWeeks = new Set(
    Array.from(new Set(sermons.map(s => s.week).filter((w): w is string => Boolean(w))))
      .sort()
      .reverse()
      .slice(0, maxWeeks),
  );
  return sermons.filter(s => !s.week || keepWeeks.has(s.week));
}
