import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDevWorshipTimeOverride,
  getEffectiveNow,
  setDevWorshipTimeOverride,
} from '../src/utils/devWorshipTimeOverride';
import { DEV_WORSHIP_TIME_OVERRIDE_KEY } from '../src/constants';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('devWorshipTimeOverride ([ISSUE-315] __DEV__ QA 도구)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 이 테스트 스위트는 jest(react-native preset)의 __DEV__가 true인 환경에서 실행된다.
  it('getDevWorshipTimeOverride: 저장된 값이 없으면 null', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    expect(await getDevWorshipTimeOverride()).toBeNull();
  });

  it('getDevWorshipTimeOverride: 저장된 ISO 문자열을 Date로 반환', async () => {
    const iso = '2026-10-11T02:50:00.000Z';
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(iso);
    const result = await getDevWorshipTimeOverride();
    expect(result).toEqual(new Date(iso));
  });

  it('getDevWorshipTimeOverride: 손상된(파싱 불가) 값이면 null', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-a-date');
    expect(await getDevWorshipTimeOverride()).toBeNull();
  });

  it('setDevWorshipTimeOverride: Date를 넘기면 ISO 문자열로 저장', async () => {
    const date = new Date('2026-10-11T02:50:00.000Z');
    await setDevWorshipTimeOverride(date);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(DEV_WORSHIP_TIME_OVERRIDE_KEY, date.toISOString());
  });

  it('setDevWorshipTimeOverride: null을 넘기면 저장된 값을 제거', async () => {
    await setDevWorshipTimeOverride(null);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(DEV_WORSHIP_TIME_OVERRIDE_KEY);
  });

  it('getEffectiveNow: 오버라이드가 있으면 그 값을 반환', async () => {
    const iso = '2026-10-11T02:50:00.000Z';
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(iso);
    expect(await getEffectiveNow()).toEqual(new Date(iso));
  });

  it('getEffectiveNow: 오버라이드가 없으면 실제 현재 시각에 가까운 값을 반환', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const before = Date.now();
    const now = await getEffectiveNow();
    const after = Date.now();
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
