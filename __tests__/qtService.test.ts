import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestQtFromAsyncStorage,
  isQtDataStale,
} from '../src/services/qtService';

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

describe('isQtDataStale', () => {
  it('returns true when date is null', () => {
    expect(isQtDataStale(null)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isQtDataStale(new Date())).toBe(false);
  });

  it('returns true for date older than 7-day default', () => {
    const old = new Date();
    old.setDate(old.getDate() - 8);
    expect(isQtDataStale(old)).toBe(true);
  });
});

describe('fetchLatestQtFromAsyncStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when AsyncStorage empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await fetchLatestQtFromAsyncStorage();
    expect(result).toBeNull();
  });

  it('parses valid QT JSON', async () => {
    const qt = { id: 'q1', title: 'QT', series_title: 'S', content: 'C', date: '2026-04-17' };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(qt));
    const result = await fetchLatestQtFromAsyncStorage();
    expect(result!.id).toBe('q1');
    expect(result!.series_title).toBe('S');
  });

  it('returns null for invalid JSON', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-json{{{');
    const result = await fetchLatestQtFromAsyncStorage();
    expect(result).toBeNull();
  });
});
