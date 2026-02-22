import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestSermonFromAsyncStorage,
  isSermonDataStale,
  syncAppGroupToAsyncStorage,
} from '../src/services/sermonService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({}));

jest.mock('../src/types/WidgetUpdateModule', () => null);

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
