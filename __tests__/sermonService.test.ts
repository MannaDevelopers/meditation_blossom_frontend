import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestSermonFromAsyncStorage,
  isSermonDataStale,
  saveSermonToAsyncStorage,
  syncAppGroupToAsyncStorage,
  fetchLatestWeeklySermonsFromAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  syncSelectedSermonToWidget,
  upsertWeeklySermonFromEvent,
} from '../src/services/sermonService';
import { Sermon, SermonRaw, WorshipType } from '../src/types/Sermon';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/types/WidgetUpdateModule', () => ({
  __esModule: true,
  default: {
    onSermonUpdated: jest.fn().mockResolvedValue(true),
    onQtUpdated: jest.fn().mockResolvedValue(true),
    getAppGroupData: jest.fn().mockResolvedValue(null),
    resolveBibleReferences: jest.fn().mockResolvedValue(''),
  },
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('isSermonDataStale', () => {
  it('returns true when sermonDate is null', () => {
    expect(isSermonDataStale(null)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isSermonDataStale(new Date())).toBe(false);
  });

  it('returns false for yesterday with default threshold', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isSermonDataStale(yesterday)).toBe(false);
  });

  it('returns true for date older than threshold', () => {
    const old = new Date();
    old.setDate(old.getDate() - 8);
    expect(isSermonDataStale(old, 7)).toBe(true);
  });

  it('returns true for date exactly at threshold', () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    expect(isSermonDataStale(cutoff, 7)).toBe(true);
  });

  it('respects custom threshold', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(isSermonDataStale(twoDaysAgo, 1)).toBe(true);
    expect(isSermonDataStale(twoDaysAgo, 3)).toBe(false);
  });
});

describe('fetchLatestSermonFromAsyncStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when AsyncStorage has no data', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await fetchLatestSermonFromAsyncStorage();
    expect(result).toBeNull();
  });

  it('parses valid sermon JSON from AsyncStorage', async () => {
    const sermonData = {
      id: 'test-1',
      title: 'Test Sermon',
      content: 'Content',
      date: '2025-01-15',
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(sermonData));
    const result = await fetchLatestSermonFromAsyncStorage();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('test-1');
    expect(result!.title).toBe('Test Sermon');
  });

  it('returns null for invalid JSON', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-valid-json{{{');
    const result = await fetchLatestSermonFromAsyncStorage();
    expect(result).toBeNull();
  });
});

describe('syncAppGroupToAsyncStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when signature matches (no change)', async () => {
    const data = '{"id":"1","title":"T"}';
    // normalized form has sorted keys, which is already sorted here
    const signature = '{"id":"1","title":"T"}';
    const result = await syncAppGroupToAsyncStorage(data, signature);
    expect(result).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns new signature when data differs from last signature', async () => {
    const data = '{"id":"1","title":"T"}';
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    const result = await syncAppGroupToAsyncStorage(data, 'old-signature');
    expect(result).not.toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('returns new signature when lastSignature is null (first sync)', async () => {
    const data = '{"id":"1","title":"T"}';
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    const result = await syncAppGroupToAsyncStorage(data, null);
    expect(result).not.toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('returns null when data is invalid JSON (normalization fails)', async () => {
    const result = await syncAppGroupToAsyncStorage('not-json{{{', null);
    expect(result).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});


describe('saveSermonToAsyncStorage', () => {
  const sermon: Sermon = {
    id: 'save-test-1',
    title: '저장 테스트',
    content: '내용',
    date: '2025-05-18',
    created_at: { seconds: 0, nanoseconds: 0 },
    updated_at: { seconds: 0, nanoseconds: 0 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AsyncStorage에 fcm_sermon 키로 JSON 저장', async () => {
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await saveSermonToAsyncStorage(sermon);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('fcm_sermon', JSON.stringify(sermon));
  });
});

describe('weekly sermons caching and syncing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves weekly sermons list to AsyncStorage', async () => {
    const list: Sermon[] = [
      { id: '1', title: 'A', content: 'C', date: '2026-09-13', week: '2026-W37', worship_type: 'SUN_0950', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
    ];
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    await saveWeeklySermonsToAsyncStorage(list);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('weekly_sermons', JSON.stringify(list));
  });

  it('reads weekly sermons list from AsyncStorage', async () => {
    const list: Sermon[] = [
      { id: '1', title: 'A', content: 'C', date: '2026-09-13', week: '2026-W37', worship_type: 'SUN_0950', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(list));
    const result = await fetchLatestWeeklySermonsFromAsyncStorage();
    expect(result).toEqual(list);
  });

  it('returns empty array when no weekly sermons in AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await fetchLatestWeeklySermonsFromAsyncStorage();
    expect(result).toEqual([]);
  });

  it('syncs selected worship sermon to widget and legacy storage key', async () => {
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const list: Sermon[] = [
      { id: 'sat', title: 'Saturday', content: 'C', date: '2026-09-12', week: '2026-W37', worship_type: 'SAT_1700', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } },
      { id: 'sun', title: 'Sunday', content: 'C', date: '2026-09-13', week: '2026-W37', worship_type: 'SUN_0950', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
    ];
    // Mock AsyncStorage reads/writes
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(JSON.stringify(list));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SUN_0950');

    // Should save Sunday sermon to legacy key
    const sundaySermon = list[1];
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('fcm_sermon', JSON.stringify(sundaySermon));
    // Should call WidgetUpdateModule
    expect(bridge.onSermonUpdated).toHaveBeenCalledWith(JSON.stringify(sundaySermon));
  });
});

describe('upsertWeeklySermonFromEvent ([#280])', () => {
  const bridge = require('../src/types/WidgetUpdateModule').default;

  beforeEach(() => {
    jest.clearAllMocks();
    (bridge.resolveBibleReferences as jest.Mock).mockResolvedValue('본문 : 요한복음 3:16 하나님이...');
  });

  it('returns null when week or worship_type is missing (레거시 이벤트 등)', async () => {
    const raw: SermonRaw = { id: '', title: 'T', content: '', date: '2026-09-15', worship_type: 'SAT_1700' };
    expect(await upsertWeeklySermonFromEvent(raw)).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('inserts into an empty cache', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const raw: SermonRaw = {
      id: '', title: 'T', content: '', date: '2026-09-12',
      week: '2026-W38', worship_type: 'SAT_1700', bible_references: '[]',
    };
    const result = await upsertWeeklySermonFromEvent(raw);

    expect(result?.worship_type).toBe('SAT_1700');
    const saved = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].worship_type).toBe('SAT_1700');
  });

  it('replaces the matching entry within the same week, leaving others untouched', async () => {
    const existing: Sermon[] = [
      { id: 'w38_sat', title: 'old sat', content: 'C', date: '2026-09-12', week: '2026-W38', worship_type: 'SAT_1700', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } },
      { id: 'w38_sun', title: 'sun', content: 'C', date: '2026-09-13', week: '2026-W38', worship_type: 'SUN_0950', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const raw: SermonRaw = {
      id: '', title: 'new sat (video 추가됨)', content: '', date: '2026-09-12',
      week: '2026-W38', worship_type: 'SAT_1700', video_url: 'https://youtu.be/new', bible_references: '[]',
    };
    await upsertWeeklySermonFromEvent(raw);

    const saved: Sermon[] = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(2);
    const sat = saved.find(s => s.worship_type === 'SAT_1700');
    const sun = saved.find(s => s.worship_type === 'SUN_0950');
    expect(sat?.title).toBe('new sat (video 추가됨)');
    expect(sat?.video_url).toBe('https://youtu.be/new');
    expect(sun?.title).toBe('sun'); // 다른 예배는 그대로
  });

  it('discards stale entries from a previous week when a new week arrives', async () => {
    const existing: Sermon[] = [
      { id: 'w37_sat', title: 'old week', content: 'C', date: '2026-09-05', week: '2026-W37', worship_type: 'SAT_1700', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const raw: SermonRaw = {
      id: '', title: 'new week sat', content: '', date: '2026-09-12',
      week: '2026-W38', worship_type: 'SAT_1700', bible_references: '[]',
    };
    await upsertWeeklySermonFromEvent(raw);

    const saved: Sermon[] = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].week).toBe('2026-W38');
  });

  it('resolves content from bible_references when content is missing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const raw: SermonRaw = {
      id: '', title: 'T', content: '', date: '2026-09-12',
      week: '2026-W38', worship_type: 'SAT_1700', bible_references: '[{"book":"요한복음","chapter":3,"verse_start":16,"verse_end":16}]',
    };
    const result = await upsertWeeklySermonFromEvent(raw);

    expect(bridge.resolveBibleReferences).toHaveBeenCalledWith(raw.bible_references);
    expect(result?.content).toBe('본문 : 요한복음 3:16 하나님이...');
  });

  it('falls back to a {week}_{worship_type} id when the payload has no id (matches Firestore doc ID)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const raw: SermonRaw = {
      id: '', title: 'T', content: '', date: '2026-09-12',
      week: '2026-W38', worship_type: 'SAT_1700', bible_references: '[]',
    };
    const result = await upsertWeeklySermonFromEvent(raw);

    expect(result?.id).toBe('2026-W38_SAT_1700');
  });
});
