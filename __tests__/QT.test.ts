import { Platform } from 'react-native';
import {
  compareQt,
  fcmDataToQt,
  firestoreDocToQt,
  QT,
  QTRaw,
} from '../src/types/QT';

jest.mock('../src/types/WidgetUpdateModule', () => ({
  __esModule: true,
  default: {
    resolveBibleReferences: jest.fn(),
  },
}));

describe('fcmDataToQt', () => {
  it('maps snake_case fields to QT', () => {
    const raw: QTRaw = {
      id: 'q-1',
      title: 'QT title',
      series_title: 'Series',
      content: 'Body',
      date: '2026-04-17',
      day_of_week: 'FRI',
    };
    const result = fcmDataToQt(raw);
    expect(result.id).toBe('q-1');
    expect(result.series_title).toBe('Series');
    expect(result.content).toBe('Body');
  });

  it('defaults missing fields to empty strings', () => {
    const raw = {} as QTRaw;
    const result = fcmDataToQt(raw);
    expect(result.title).toBe('');
    expect(result.series_title).toBe('');
    expect(result.content).toBe('');
  });

  it('preserves video_url when present', () => {
    const raw: QTRaw = {
      id: '1', title: 'T', series_title: '', content: 'C', date: '2026-04-17',
      video_url: 'https://youtu.be/xyz',
    };
    expect(fcmDataToQt(raw).video_url).toBe('https://youtu.be/xyz');
  });

  it('매핑: meditation_questions 있으면 그대로 전달됨', () => {
    const raw: QTRaw = {
      id: '1', title: 'T', series_title: '', content: 'C', date: '2026-04-17',
      meditation_questions: '["오늘 말씀에서 가장 마음에 닿은 구절은?","이 말씀을 삶에 어떻게 적용할 수 있을까?"]',
    };
    expect(fcmDataToQt(raw).meditation_questions).toBe(
      '["오늘 말씀에서 가장 마음에 닿은 구절은?","이 말씀을 삶에 어떻게 적용할 수 있을까?"]',
    );
  });

  it('매핑: meditation_questions 없으면 undefined', () => {
    const raw: QTRaw = {
      id: '1', title: 'T', series_title: '', content: 'C', date: '2026-04-17',
    };
    expect(fcmDataToQt(raw).meditation_questions).toBeUndefined();
  });

  // #144: App Group(위젯) 경로는 meditation_questions를 배열로 저장하는데,
  // 이 배열이 AsyncStorage로 복사돼 들어오면 문자열로 정규화해야 화면 파서가 깨지지 않는다.
  it('정규화: meditation_questions가 배열이면 JSON 문자열로 변환', () => {
    const raw = {
      id: '1', title: 'T', series_title: '', content: 'C', date: '2026-04-17',
      meditation_questions: ['질문1', '질문2'],
    } as unknown as QTRaw;
    expect(fcmDataToQt(raw).meditation_questions).toBe('["질문1","질문2"]');
  });
});

describe('compareQt', () => {
  const makeQt = (date: string, updatedSeconds = 0): QT => ({
    id: '1',
    title: 'T',
    series_title: 'S',
    content: 'C',
    date,
    created_at: { seconds: 0, nanoseconds: 0 },
    updated_at: { seconds: updatedSeconds, nanoseconds: 0 },
  });

  it('returns 0 for both null', () => {
    expect(compareQt(null, null)).toBe(0);
  });

  it('prefers later date', () => {
    expect(compareQt(makeQt('2026-04-17'), makeQt('2026-04-16'))).toBe(1);
  });

  it('compares updated_at when dates equal', () => {
    expect(compareQt(makeQt('2026-04-17', 200), makeQt('2026-04-17', 100))).toBe(1);
  });
});

describe('firestoreDocToQt', () => {
  const bridge = require('../src/types/WidgetUpdateModule').default;
  const makeDoc = (data: any): any => ({ id: 'doc-q', data: () => data });

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  it('on Android resolves content via bridge', async () => {
    bridge.resolveBibleReferences.mockResolvedValue('본문 : 에베소서 5:15-16 RESOLVED');
    const doc = makeDoc({
      title: 'T',
      series_title: 'Daily',
      date: '2026-04-17',
      bible_references: [{ book: '에베소서', chapter: 5, verse_start: 15, verse_end: 16 }],
    });
    const result = await firestoreDocToQt(doc);
    expect(result.content).toBe('본문 : 에베소서 5:15-16 RESOLVED');
  });

  it('on iOS returns empty content', async () => {
    (Platform as any).OS = 'ios';
    const doc = makeDoc({
      title: 'T', series_title: 'Daily', date: '2026-04-17',
      bible_references: [{ book: '에베소서', chapter: 5, verse_start: 15, verse_end: 16 }],
    });
    const result = await firestoreDocToQt(doc);
    expect(result.content).toBe('');
  });

  it('Firestore array를 JSON 문자열로 변환', async () => {
    const doc = makeDoc({
      title: 'T', series_title: 'Daily', date: '2026-04-17',
      meditation_questions: ['오늘 말씀에서 가장 마음에 와닿는 구절은?', '이 말씀을 삶에 어떻게 적용할 수 있을까?'],
    });
    const result = await firestoreDocToQt(doc);
    expect(result.meditation_questions).toBe(
      '["오늘 말씀에서 가장 마음에 와닿는 구절은?","이 말씀을 삶에 어떻게 적용할 수 있을까?"]',
    );
  });
});
