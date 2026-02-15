import {
  compareSermon,
  convertStringToTimestamp,
  fcmDataToSermon,
  FirestoreTimestamp,
  Sermon,
  SermonRaw,
} from '../src/types/Sermon';

describe('convertStringToTimestamp', () => {
  it('returns zero timestamp for null input', () => {
    expect(convertStringToTimestamp(null)).toEqual({ seconds: 0, nanoseconds: 0 });
  });

  it('returns zero timestamp for undefined input', () => {
    expect(convertStringToTimestamp(undefined)).toEqual({ seconds: 0, nanoseconds: 0 });
  });

  it('returns zero timestamp for empty string', () => {
    expect(convertStringToTimestamp('')).toEqual({ seconds: 0, nanoseconds: 0 });
  });

  it('parses ISO 8601 date string', () => {
    const result = convertStringToTimestamp('2025-01-15T00:00:00.000Z');
    expect(result.seconds).toBe(Math.floor(new Date('2025-01-15T00:00:00.000Z').getTime() / 1000));
    expect(result.nanoseconds).toBe(0);
  });

  it('parses Korean locale format', () => {
    const result = convertStringToTimestamp('2025년 11월 11일 오전 5시 18분 46초 UTC+9');
    expect(result.seconds).toBeGreaterThan(0);
  });

  it('parses Korean PM format', () => {
    const result = convertStringToTimestamp('2025년 3월 15일 오후 2시 30분 0초 UTC+9');
    expect(result.seconds).toBeGreaterThan(0);
  });

  it('handles Korean noon (오후 12시)', () => {
    const result = convertStringToTimestamp('2025년 1월 1일 오후 12시 0분 0초 UTC+9');
    expect(result.seconds).toBeGreaterThan(0);
  });

  it('handles Korean midnight (오전 12시)', () => {
    const result = convertStringToTimestamp('2025년 1월 1일 오전 12시 0분 0초 UTC+9');
    expect(result.seconds).toBeGreaterThan(0);
  });

  it('returns zero timestamp for unparseable string', () => {
    expect(convertStringToTimestamp('not-a-date')).toEqual({ seconds: 0, nanoseconds: 0 });
  });
});

describe('compareSermon', () => {
  const makeSermon = (date: string, updatedSeconds: number = 0): Sermon => ({
    id: '1',
    title: 'Test',
    content: 'Content',
    date,
    created_at: { seconds: 0, nanoseconds: 0 },
    updated_at: { seconds: updatedSeconds, nanoseconds: 0 },
  });

  it('returns 0 for two nulls', () => {
    expect(compareSermon(null, null)).toBe(0);
  });

  it('returns -1 when a is null', () => {
    expect(compareSermon(null, makeSermon('2025-01-01'))).toBe(-1);
  });

  it('returns 1 when b is null', () => {
    expect(compareSermon(makeSermon('2025-01-01'), null)).toBe(1);
  });

  it('returns 1 when a.date > b.date', () => {
    expect(compareSermon(makeSermon('2025-01-02'), makeSermon('2025-01-01'))).toBe(1);
  });

  it('returns -1 when a.date < b.date', () => {
    expect(compareSermon(makeSermon('2025-01-01'), makeSermon('2025-01-02'))).toBe(-1);
  });

  it('compares updated_at when dates are equal', () => {
    expect(compareSermon(makeSermon('2025-01-01', 200), makeSermon('2025-01-01', 100))).toBe(1);
  });

  it('returns 0 when both date and updated_at are equal', () => {
    expect(compareSermon(makeSermon('2025-01-01', 100), makeSermon('2025-01-01', 100))).toBe(0);
  });
});

describe('fcmDataToSermon', () => {
  it('converts basic raw data to Sermon', () => {
    const raw: SermonRaw = {
      id: 'test-1',
      title: 'Test Title',
      content: 'Test Content',
      date: '2025-01-15',
      day_of_week: 'SUN',
    };
    const result = fcmDataToSermon(raw);
    expect(result.id).toBe('test-1');
    expect(result.title).toBe('Test Title');
    expect(result.date).toBe('2025-01-15');
    expect(result.day_of_week).toBe('SUN');
  });

  it('uses camelCase fallback for day_of_week', () => {
    const raw: SermonRaw = {
      id: '1',
      title: 'T',
      content: 'C',
      date: '2025-01-01',
      dayOfWeek: 'MON',
    };
    expect(fcmDataToSermon(raw).day_of_week).toBe('MON');
  });

  it('converts string created_at to FirestoreTimestamp', () => {
    const raw: SermonRaw = {
      id: '1',
      title: 'T',
      content: 'C',
      date: '2025-01-01',
      created_at: '2025-01-15T12:00:00.000Z',
    };
    const result = fcmDataToSermon(raw);
    expect(result.created_at.seconds).toBeGreaterThan(0);
  });

  it('preserves FirestoreTimestamp object in created_at', () => {
    const ts: FirestoreTimestamp = { seconds: 1000, nanoseconds: 500 };
    const raw: SermonRaw = {
      id: '1',
      title: 'T',
      content: 'C',
      date: '2025-01-01',
      created_at: ts,
    };
    expect(fcmDataToSermon(raw).created_at).toEqual(ts);
  });

  it('defaults missing fields to empty strings', () => {
    const raw = {} as SermonRaw;
    const result = fcmDataToSermon(raw);
    expect(result.id).toBe('');
    expect(result.title).toBe('');
    expect(result.content).toBe('');
    expect(result.date).toBe('');
  });
});
