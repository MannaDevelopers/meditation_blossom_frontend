import {
  hasWorshipTimeArrived,
  latestMatchingWeeklySermon,
  resolveIsoWeekMonday,
  resolveNextWorshipDateTime,
  resolveWorshipDateTime,
  WORSHIP_SCHEDULE,
} from '../src/utils/worshipSchedule';
import { Sermon } from '../src/types/Sermon';

describe('resolveIsoWeekMonday', () => {
  it('resolves the well-known ISO week epoch anchor (1970-W01 -> 1969-12-29, Monday)', () => {
    const monday = resolveIsoWeekMonday('1970-W01');
    expect(monday).toEqual(new Date(1969, 11, 29));
    expect(monday!.getDay()).toBe(1); // Monday
  });

  it('resolves a year-boundary week (2026-W01 -> 2025-12-29, Monday)', () => {
    const monday = resolveIsoWeekMonday('2026-W01');
    expect(monday).toEqual(new Date(2025, 11, 29));
    expect(monday!.getDay()).toBe(1);
  });

  it('always returns a Monday for a range of weeks/years', () => {
    const cases = ['2024-W01', '2024-W53', '2025-W20', '2027-W37'];
    for (const week of cases) {
      const monday = resolveIsoWeekMonday(week);
      expect(monday).not.toBeNull();
      expect(monday!.getDay()).toBe(1);
      expect(monday!.getHours()).toBe(0);
    }
  });

  it('returns null for malformed input', () => {
    expect(resolveIsoWeekMonday('')).toBeNull();
    expect(resolveIsoWeekMonday('2026-37')).toBeNull();
    expect(resolveIsoWeekMonday('not-a-week')).toBeNull();
    expect(resolveIsoWeekMonday('2026-W00')).toBeNull();
    expect(resolveIsoWeekMonday('2026-W54')).toBeNull();
  });
});

describe('resolveWorshipDateTime', () => {
  it('resolves SAT_1700 / SUN_0950 for the ISO week epoch anchor', () => {
    // 1970-W01 Monday = 1969-12-29 -> Sat(1970-01-03) 17:00, Sun(1970-01-04) 09:50
    expect(resolveWorshipDateTime('1970-W01', 'SAT_1700')).toEqual(new Date(1970, 0, 3, 17, 0, 0, 0));
    expect(resolveWorshipDateTime('1970-W01', 'SUN_0950')).toEqual(new Date(1970, 0, 4, 9, 50, 0, 0));
  });

  it('orders the 4 worship times within the same week correctly', () => {
    const week = '2026-W37';
    const times = (['SAT_1700', 'SUN_0950', 'SUN_1150', 'SUN_1430'] as const).map(
      t => resolveWorshipDateTime(week, t)!.getTime(),
    );
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('applies the hour/minute from WORSHIP_SCHEDULE exactly', () => {
    const week = '2026-W37';
    for (const [type, schedule] of Object.entries(WORSHIP_SCHEDULE) as [
      keyof typeof WORSHIP_SCHEDULE,
      (typeof WORSHIP_SCHEDULE)[keyof typeof WORSHIP_SCHEDULE],
    ][]) {
      const dt = resolveWorshipDateTime(week, type)!;
      expect(dt.getHours()).toBe(schedule.hour);
      expect(dt.getMinutes()).toBe(schedule.minute);
    }
  });

  it('returns null for malformed week', () => {
    expect(resolveWorshipDateTime('bad-week', 'SUN_0950')).toBeNull();
  });
});

describe('hasWorshipTimeArrived', () => {
  const week = '2026-W37';
  const worshipType = 'SUN_1150' as const;
  const scheduled = resolveWorshipDateTime(week, worshipType)!;

  it('is false just before the scheduled time', () => {
    const before = new Date(scheduled.getTime() - 1);
    expect(hasWorshipTimeArrived(week, worshipType, before)).toBe(false);
  });

  it('is true exactly at the scheduled time', () => {
    expect(hasWorshipTimeArrived(week, worshipType, new Date(scheduled.getTime()))).toBe(true);
  });

  it('is true after the scheduled time', () => {
    const after = new Date(scheduled.getTime() + 1);
    expect(hasWorshipTimeArrived(week, worshipType, after)).toBe(true);
  });

  it('defaults to the current time when now is omitted', () => {
    // 이미 지난 예배(과거 week)라면 항상 true여야 한다.
    expect(hasWorshipTimeArrived('2020-W01', 'SUN_0950')).toBe(true);
  });

  it('fails open (true) when week/worshipType is missing or unparseable', () => {
    expect(hasWorshipTimeArrived(undefined, 'SUN_0950')).toBe(true);
    expect(hasWorshipTimeArrived('2026-W37', undefined)).toBe(true);
    expect(hasWorshipTimeArrived('not-a-week', 'SUN_0950')).toBe(true);
  });
});

describe('resolveNextWorshipDateTime', () => {
  it('returns this week\'s time when it has not arrived yet', () => {
    // 2026-09-28(월) 09:00 -> 이번 주(2026-W40) SUN_1150은 아직 미래(10/4 11:50)
    const now = new Date(2026, 8, 28, 9, 0, 0);
    const next = resolveNextWorshipDateTime('SUN_1150', now);
    expect(next).toEqual(resolveWorshipDateTime('2026-W40', 'SUN_1150'));
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('rolls over to next week when this week\'s time has already passed', () => {
    // 2026-10-04(일) 12:00 -> 이번 주 SUN_1150(11:50)은 이미 지남 -> 다음 주(2026-W41)
    const now = new Date(2026, 9, 4, 12, 0, 0);
    const next = resolveNextWorshipDateTime('SUN_1150', now);
    expect(next).toEqual(resolveWorshipDateTime('2026-W41', 'SUN_1150'));
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns exactly now\'s week when called right at the boundary is treated as passed', () => {
    const scheduled = resolveWorshipDateTime('2026-W40', 'SUN_1150')!;
    const next = resolveNextWorshipDateTime('SUN_1150', scheduled);
    // candidate > now 조건이므로 정확히 그 시각이면 "이미 지남"으로 보고 다음 주로 넘어간다.
    expect(next).toEqual(resolveWorshipDateTime('2026-W41', 'SUN_1150'));
  });
});

describe('latestMatchingWeeklySermon ([ISSUE-315] 같은 worship_type의 week 중복 해소)', () => {
  const ts = { seconds: 0, nanoseconds: 0 };
  const makeSermon = (worship_type: Sermon['worship_type'], id: string, week: string): Sermon => ({
    id, title: id, content: 'C', date: '2026-09-13', week, worship_type, created_at: ts, updated_at: ts,
  });

  it('일치하는 항목이 없으면 null', () => {
    expect(latestMatchingWeeklySermon([], 'SUN_1150')).toBeNull();
  });

  it('일치하는 항목이 하나면 그걸 반환한다', () => {
    const only = makeSermon('SUN_1150', 'only', '2026-W37');
    expect(latestMatchingWeeklySermon([only], 'SUN_1150')).toEqual(only);
  });

  it('같은 worship_type이 여러 week로 있으면 가장 최신 week을 반환한다 — 배열 순서와 무관', () => {
    // mergeFreshWeeklyResults가 격리 테스트 데이터(미래 week)와 실제 서버 데이터(현재 week)를
    // 둘 다 보존하게 되면서, 이 함수가 그중 어느 쪽을 보여줄지 결정한다(실사용자 리포트로
    // 발견한 시나리오 재현).
    const older = makeSermon('SUN_1150', 'older', '2026-W37');
    const newer = makeSermon('SUN_1150', 'newer', '2026-W40');
    expect(latestMatchingWeeklySermon([older, newer], 'SUN_1150')).toEqual(newer);
    expect(latestMatchingWeeklySermon([newer, older], 'SUN_1150')).toEqual(newer);
  });

  it('다른 worship_type은 무시한다', () => {
    const sun = makeSermon('SUN_1150', 'sun', '2026-W40');
    const sat = makeSermon('SAT_1700', 'sat', '2026-W41');
    expect(latestMatchingWeeklySermon([sun, sat], 'SUN_1150')).toEqual(sun);
  });
});
