import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestSermonFromAsyncStorage,
  isSermonDataStale,
  saveSermonToAsyncStorage,
  syncAppGroupToAsyncStorage,
  fetchLatestWeeklySermonsFromAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  syncSelectedSermonToWidget,
} from '../src/services/sermonService';
import { Sermon, WorshipType } from '../src/types/Sermon';

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
      { id: '1', title: 'A', content: 'C', date: '2026-07-19', worship_type: 'SUN_1000', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
    ];
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    await saveWeeklySermonsToAsyncStorage(list);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('weekly_sermons', JSON.stringify(list));
  });

  it('reads weekly sermons list from AsyncStorage', async () => {
    const list: Sermon[] = [
      { id: '1', title: 'A', content: 'C', date: '2026-07-19', worship_type: 'SUN_1000', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
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
      { id: 'thu', title: 'Thursday', content: 'C', date: '2026-07-19', worship_type: 'THU_EVE', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } },
      { id: 'sun', title: 'Sunday', content: 'C', date: '2026-07-19', worship_type: 'SUN_1000', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
    ];
    // Mock AsyncStorage reads/writes
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(JSON.stringify(list));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SUN_1000');

    // Should save Sunday sermon to legacy key
    const sundaySermon = list[1];
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('fcm_sermon', JSON.stringify(sundaySermon));
    // Should call WidgetUpdateModule
    expect(bridge.onSermonUpdated).toHaveBeenCalledWith(JSON.stringify(sundaySermon));
  });
});
