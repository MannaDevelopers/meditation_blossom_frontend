import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestSermonFromAsyncStorage,
  isSermonDataStale,
  saveSermonToAsyncStorage,
  syncAppGroupToAsyncStorage,
  fetchLatestWeeklySermonsFromAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  sermonFromLegacyEvent,
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

  it('로컬 weekly_sermons 캐시가 비어있으면 서버에서 조회해 채우고 동기화한다 (앱을 막 업데이트한 사용자가 예배 시간을 바꿨을 때)', async () => {
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const firestoreMock = require('@react-native-firebase/firestore');
    const docs = [
      { id: 'w40_sat', data: () => ({ title: 'Sat', date: '2026-10-03', week: '2026-W40', worship_type: 'SAT_1700', content: 'C' }) },
      { id: 'w40_sun1150', data: () => ({ title: 'Sun 1150', date: '2026-10-04', week: '2026-W40', worship_type: 'SUN_1150', content: 'C' }) },
    ];
    firestoreMock.getDocsFromServer.mockResolvedValue({ empty: false, docs });

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(null); // 캐시 없음
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SUN_1150');

    // 서버에서 받아온 주간 데이터를 캐시에 저장해야 한다
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'weekly_sermons',
      expect.stringContaining('"worship_type":"SUN_1150"'),
    );
    // 선택된 예배로 위젯/레거시 키가 갱신돼야 한다
    expect(bridge.onSermonUpdated).toHaveBeenCalledWith(
      expect.stringContaining('"worship_type":"SUN_1150"'),
    );
  });

  it('로컬 캐시도 비어있고 서버 조회도 실패하면(오프라인) 조용히 아무 것도 하지 않는다', async () => {
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const firestoreMock = require('@react-native-firebase/firestore');
    firestoreMock.getDocsFromServer.mockRejectedValue(new Error('network error'));

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    bridge.onSermonUpdated.mockClear();

    await expect(syncSelectedSermonToWidget('SUN_0950')).resolves.toBeUndefined();
    expect(bridge.onSermonUpdated).not.toHaveBeenCalled();
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

describe('sermonFromLegacyEvent (레거시 sermon_events/sermon_events_v2, "전체" 옵션)', () => {
  const bridge = require('../src/types/WidgetUpdateModule').default;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // v1(sermon_events)은 content를 평문으로 그대로 실어 보내므로 추가 조회가 필요 없다.
  it('v1(content 포함) payload는 content를 그대로 쓰고 bible DB를 조회하지 않는다', async () => {
    const raw: SermonRaw = {
      id: '', title: 'T', content: '본문 : 요나 3:1-10\n...', date: '2026-09-12',
      day_of_week: 'SUN', source_id: '199134',
    };
    const result = await sermonFromLegacyEvent(raw);

    expect(result.content).toBe('본문 : 요나 3:1-10\n...');
    expect(bridge.resolveBibleReferences).not.toHaveBeenCalled();
  });

  // v2(sermon_events_v2)는 4KB payload 제한 때문에 content 없이 bible_references만 보낸다.
  // verses[].content가 실려 오더라도 긴 설교는 잘려 빠질 수 있어 신뢰하지 않고, 항상
  // book/chapter/verse 범위로 로컬 성경 DB를 다시 조회해 본문을 조립한다.
  it('v2(bible_references만 있는) payload는 verses를 무시하고 로컬 성경 DB에서 본문을 조회한다', async () => {
    (bridge.resolveBibleReferences as jest.Mock).mockResolvedValue('본문 : 요나 3:1-10 여호와의 말씀이...');
    const raw: SermonRaw = {
      id: '', title: 'T', content: '', date: '2026-09-12', day_of_week: 'SUN',
      source_id: '199134',
      bible_references: '[{"book":"요나","chapter":3,"verse_start":1,"verse_end":10,"verses":[{"verse_number":1,"content":"페이로드에 실려온(잘렸을 수도 있는) 본문"}]}]',
    };
    const result = await sermonFromLegacyEvent(raw);

    expect(bridge.resolveBibleReferences).toHaveBeenCalledWith(raw.bible_references);
    expect(result.content).toBe('본문 : 요나 3:1-10 여호와의 말씀이...');
    expect(result.content).not.toContain('페이로드에 실려온');
  });

  it('payload에 id가 없으면 source_id를 id로 쓴다', async () => {
    const raw: SermonRaw = {
      id: '', title: 'T', content: 'C', date: '2026-09-12', day_of_week: 'SUN', source_id: '199134',
    };
    const result = await sermonFromLegacyEvent(raw);
    expect(result.id).toBe('199134');
  });

  it('bible DB 조회가 실패해도 예외를 던지지 않고 빈 본문으로 진행한다', async () => {
    (bridge.resolveBibleReferences as jest.Mock).mockRejectedValue(new Error('bridge down'));
    const raw: SermonRaw = {
      id: '', title: 'T', content: '', date: '2026-09-12', day_of_week: 'SUN',
      bible_references: '[]',
    };
    const result = await sermonFromLegacyEvent(raw);
    expect(result.content).toBe('');
  });
});
