import { isoWeekFromDateString, toIsoWeek } from '../src/utils/isoWeek';

describe('toIsoWeek', () => {
  // sermons-v2.md 정의값 — 실제 서버가 내려주는 week 필드와 일치해야 한다.
  it('연초/연말 경계에서도 ISO 8601 규칙(목요일 기준)을 따른다', () => {
    expect(toIsoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01');
    // 2025-12-31은 목요일이 다음 해로 넘어가지 않아 2025년 마지막 주에 속한다.
    expect(toIsoWeek(new Date(Date.UTC(2025, 11, 31)))).toBe('2026-W01');
  });

  it('같은 주의 토요일과 주일은 같은 week을 반환한다', () => {
    const saturday = new Date(Date.UTC(2026, 8, 12)); // 2026-09-12(토)
    const sunday = new Date(Date.UTC(2026, 8, 13)); // 2026-09-13(일)
    expect(toIsoWeek(saturday)).toBe(toIsoWeek(sunday));
  });
});

describe('isoWeekFromDateString', () => {
  it('YYYY-MM-DD 문자열로부터 week을 계산한다', () => {
    expect(isoWeekFromDateString('2026-09-13')).toBe(toIsoWeek(new Date(Date.UTC(2026, 8, 13))));
  });

  it('비어있거나 파싱할 수 없는 값은 null', () => {
    expect(isoWeekFromDateString(undefined)).toBeNull();
    expect(isoWeekFromDateString(null)).toBeNull();
    expect(isoWeekFromDateString('')).toBeNull();
    expect(isoWeekFromDateString('not-a-date')).toBeNull();
  });
});
