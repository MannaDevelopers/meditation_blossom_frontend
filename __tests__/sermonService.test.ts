import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchLatestSermonFromAsyncStorage,
  fetchLegacySermonFromCache,
  isSermonDataStale,
  mergeFreshWeeklyResults,
  mergeWeeklySermonIntoCache,
  saveLegacySermonToCache,
  saveSermonToAsyncStorage,
  syncAppGroupToAsyncStorage,
  fetchLatestWeeklySermonsFromAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  sermonFromLegacyEvent,
  syncSelectedSermonToWidget,
  upsertWeeklySermonFromEvent,
} from '../src/services/sermonService';
import { LEGACY_SERMON_CACHE_KEY, Sermon, SermonRaw, WorshipType } from '../src/types/Sermon';
import { resolveWorshipDateTime, selectGatedWeeklySermon } from '../src/utils/worshipSchedule';

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

// '전체' 옵션 전용 캐시 — FCM_SERMON_KEY와 완전히 분리된 키를 쓰는지가 이 기능의 핵심
// 불변식이다. 섞이면 특정 예배시간을 보다가 '전체'로 돌아왔을 때 그 예배(sermons-v2)
// 내용을 legacy 내용으로 착각하는 사고가 난다(실사용자 리포트).
describe('fetchLegacySermonFromCache / saveLegacySermonToCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('FCM_SERMON_KEY가 아니라 LEGACY_SERMON_CACHE_KEY를 읽고 쓴다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    const sermon: Sermon = {
      id: 'legacy-1', title: 'T', content: 'C', date: '2026-09-22',
      created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
    };

    await saveLegacySermonToCache(sermon);
    await fetchLegacySermonFromCache();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(LEGACY_SERMON_CACHE_KEY, JSON.stringify(sermon));
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(LEGACY_SERMON_CACHE_KEY);
  });

  it('저장된 데이터가 없으면 null', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    expect(await fetchLegacySermonFromCache()).toBeNull();
  });

  it('손상된 JSON이면 null을 반환하고 캐시를 지운다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not-valid-json{{{');
    const result = await fetchLegacySermonFromCache();
    expect(result).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LEGACY_SERMON_CACHE_KEY);
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

  it('[ISSUE-315] 일치하는 예배가 캐시에 없으면 다른 예배시간의 미도착 콘텐츠를 새치기하지 않고 기존 콘텐츠를 유지한다 (실사용자 리포트)', async () => {
    // 캐시엔 SUN_1150(아직 시각이 안 됨) 하나뿐인데, 설정을 SUN_0950으로 바꾼 상황을
    // 재현한다. 예전 폴백(weekly[0])이 있으면 SUN_0950 요청인데도 SUN_1150의 미도착
    // 콘텐츠가 그대로 fcm_sermon에 저장돼버렸다.
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const notYetArrived: Sermon = {
      id: 'sun1150', title: 'SUN_1150 미도착', content: 'C', date: '2026-10-11',
      week: '2099-W01', worship_type: 'SUN_1150', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
    };
    const previouslyDisplayed: Sermon = {
      id: 'old', title: '이전에 보여주던 설교', content: 'C', date: '2026-09-13',
      week: '2026-W37', worship_type: 'SUN_0950', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(JSON.stringify([notYetArrived]));
      if (key === 'fcm_sermon') return Promise.resolve(JSON.stringify(previouslyDisplayed));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SUN_0950');

    // fetchLatestSermonFromAsyncStorage가 fcmDataToSermon으로 정규화(day_of_week 기본값
    // 추가 등)하므로 원본 JSON과 바이트 단위로는 다를 수 있다 — 핵심 필드만 확인한다.
    expect(bridge.onSermonUpdated).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(bridge.onSermonUpdated.mock.calls[0][0]);
    expect(saved.id).toBe(previouslyDisplayed.id);
    expect(saved.worship_type).toBe('SUN_0950');
    expect(saved.worship_type).not.toBe('SUN_1150');
  });

  it('[ISSUE-315] 캐시에 일치하는 예배가 없으면 (비어있지 않아도) 서버에서 그 예배시간의 진짜 데이터를 다시 가져온다', async () => {
    // 캐시엔 SUN_1150(이미 도달, 실제로 화면에 떠 있음)만 있는 상태에서 SAT_1700으로
    // 바꾼 상황. 캐시가 "비어있지 않다"는 이유로 서버 재조회를 안 하면, SAT_1700 요청인데도
    // 직전에 보이던 SUN_1150 콘텐츠를 그대로 물려받아버린다(실사용자 리포트로 발견 —
    // 예배시간을 이리저리 바꾸는 것만으로 서로 다른 예배 콘텐츠가 섞여 보임).
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const firestoreMock = require('@react-native-firebase/firestore');
    const arrivedSun1150: Sermon = {
      id: 'sun1150', title: 'SUN_1150 화면에 떠 있음', content: 'C', date: '2026-09-13',
      week: '2026-W37', worship_type: 'SUN_1150', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
    };
    // week는 실행 시점의 실제 현재 시각에 상관없이 항상 "이미 지난 주"여야 한다
    // (getEffectiveNow가 실제 시각을 쓰므로) — 2026-W37은 다른 테스트에서도 이미
    // 지난 주로 취급된다.
    const realSatDocs = [
      { id: 'w37_sat', data: () => ({ title: '진짜 토요 예배', date: '2026-09-12', week: '2026-W37', worship_type: 'SAT_1700', content: 'C' }) },
    ];
    firestoreMock.getDocsFromServer.mockResolvedValue({ empty: false, docs: realSatDocs });

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(JSON.stringify([arrivedSun1150]));
      if (key === 'fcm_sermon') return Promise.resolve(JSON.stringify(arrivedSun1150));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SAT_1700');

    expect(firestoreMock.getDocsFromServer).toHaveBeenCalled();
    expect(bridge.onSermonUpdated).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(bridge.onSermonUpdated.mock.calls[0][0]);
    expect(saved.worship_type).toBe('SAT_1700');
    expect(saved.title).toBe('진짜 토요 예배');
  });

  it('[ISSUE-315] 캐시에 일치하는 예배가 없고 서버 재조회도 실패하면 기존 콘텐츠를 유지한다(오프라인)', async () => {
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const firestoreMock = require('@react-native-firebase/firestore');
    firestoreMock.getDocsFromServer.mockRejectedValue(new Error('network error'));

    const arrivedSun1150: Sermon = {
      id: 'sun1150', title: 'SUN_1150 화면에 떠 있음', content: 'C', date: '2026-09-13',
      week: '2026-W37', worship_type: 'SUN_1150', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(JSON.stringify([arrivedSun1150]));
      if (key === 'fcm_sermon') return Promise.resolve(JSON.stringify(arrivedSun1150));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SAT_1700');

    expect(bridge.onSermonUpdated).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(bridge.onSermonUpdated.mock.calls[0][0]);
    expect(saved.worship_type).not.toBe('SAT_1700'); // 진짜 SAT_1700 데이터를 못 구함
    expect(saved.id).toBe('sun1150'); // 하지만 SUN_1150 콘텐츠를 그대로 유지(새치기 아님)
  });

  it('[ISSUE-315] 다른 예배시간으로 전환하며 서버 재조회를 해도, 로컬에만 있던(FCM으로 받은) 다른 예배시간 콘텐츠를 지우지 않는다', async () => {
    // 캐시엔 FCM으로만 받은 SUN_1150(Firestore에는 없음)이 있는 상태에서 SAT_1700으로
    // 전환. 서버 응답을 캐시에 그대로 덮어쓰면(교체) SUN_1150이 사라진다 — 실사용자 리포트로
    // 발견: 예배시간을 바꿀 때마다 방금 FCM으로 받은 내용이 날아감.
    const bridge = require('../src/types/WidgetUpdateModule').default;
    const firestoreMock = require('@react-native-firebase/firestore');
    const fcmOnlySun1150: Sermon = {
      id: 'fcm-sun1150', title: 'FCM으로만 받은 SUN_1150', content: 'C', date: '2026-09-13',
      week: '2026-W37', worship_type: 'SUN_1150', created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
    };
    const realSatDocs = [
      { id: 'w37_sat', data: () => ({ title: '진짜 토요 예배', date: '2026-09-12', week: '2026-W37', worship_type: 'SAT_1700', content: 'C' }) },
    ];
    firestoreMock.getDocsFromServer.mockResolvedValue({ empty: false, docs: realSatDocs });

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'weekly_sermons') return Promise.resolve(JSON.stringify([fcmOnlySun1150]));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    bridge.onSermonUpdated.mockClear();

    await syncSelectedSermonToWidget('SAT_1700');

    const savedWeeklyCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(([key]) => key === 'weekly_sermons');
    expect(savedWeeklyCall).toBeDefined();
    const savedWeekly = JSON.parse(savedWeeklyCall![1]);
    const types = savedWeekly.map((s: Sermon) => s.worship_type);
    expect(types).toContain('SAT_1700');
    expect(types).toContain('SUN_1150'); // FCM으로만 받은 것도 그대로 남아있어야 한다
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

describe('selectGatedWeeklySermon ([ISSUE-315] 예배시간 게이팅)', () => {
  const ts = { seconds: 0, nanoseconds: 0 };
  // week/worship_type과 무관하게, 명시적으로 넘기는 now 기준으로만 판단하도록 테스트한다
  // (실행 시점의 실제 현재 시각에 의존하면 나중에 테스트가 깨진다).
  const week = '2026-W37';
  const scheduled = resolveWorshipDateTime(week, 'SUN_1150')!;
  const beforeArrival = new Date(scheduled.getTime() - 1);
  const afterArrival = new Date(scheduled.getTime() + 1);

  const makeSermon = (worship_type: WorshipType, id: string): Sermon => ({
    id,
    title: id,
    content: 'C',
    date: '2026-09-13',
    week,
    worship_type,
    created_at: ts,
    updated_at: ts,
  });

  it('시각이 이미 지난 후보를 찾으면 후보를 반환한다', () => {
    const weekly = [makeSermon('SUN_1150', 'candidate')];
    const previous = makeSermon('SUN_1150', 'old');
    expect(selectGatedWeeklySermon(weekly, 'SUN_1150', previous, afterArrival)).toEqual(weekly[0]);
  });

  it('시각이 아직 안 된 후보면 기존에 보여주던 콘텐츠를 그대로 유지한다', () => {
    const weekly = [makeSermon('SUN_1150', 'candidate')];
    const previous = makeSermon('SUN_1150', 'old');
    expect(selectGatedWeeklySermon(weekly, 'SUN_1150', previous, beforeArrival)).toEqual(previous);
  });

  it('일치하는 후보가 캐시에 없으면 기존 콘텐츠를 유지한다', () => {
    const weekly = [makeSermon('SAT_1700', 'other')];
    const previous = makeSermon('SUN_1150', 'old');
    expect(selectGatedWeeklySermon(weekly, 'SUN_1150', previous, afterArrival)).toEqual(previous);
  });

  it('기존에 보여준 콘텐츠가 전혀 없으면(최초 설치 등) 시각이 안 됐어도 후보를 보여준다', () => {
    const weekly = [makeSermon('SUN_1150', 'candidate')];
    expect(selectGatedWeeklySermon(weekly, 'SUN_1150', null, beforeArrival)).toEqual(weekly[0]);
  });

  it('후보도 없고 기존 콘텐츠도 없으면 null', () => {
    expect(selectGatedWeeklySermon([], 'SUN_1150', null, beforeArrival)).toBeNull();
  });
});

describe('mergeFreshWeeklyResults ([ISSUE-315] 서버 재조회 시 캐시 병합)', () => {
  const ts = { seconds: 0, nanoseconds: 0 };
  const makeSermon = (worship_type: WorshipType, id: string, week = '2026-W37'): Sermon => ({
    id, title: id, content: 'C', date: '2026-09-13', week, worship_type, created_at: ts, updated_at: ts,
  });

  it('fresh가 다루는 worship_type만 교체하고, 나머지 기존 항목은 보존한다', () => {
    const existing = [makeSermon('SUN_1150', 'old-sun1150')];
    const fresh = [makeSermon('SAT_1700', 'new-sat')];
    const merged = mergeFreshWeeklyResults(existing, fresh);
    expect(merged).toHaveLength(2);
    expect(merged).toEqual(expect.arrayContaining([existing[0], fresh[0]]));
  });

  it('fresh에 같은 worship_type이 있으면 기존 것을 교체한다(중복 없음)', () => {
    const existing = [makeSermon('SUN_1150', 'old-sun1150')];
    const fresh = [makeSermon('SUN_1150', 'new-sun1150')];
    const merged = mergeFreshWeeklyResults(existing, fresh);
    expect(merged).toEqual([fresh[0]]);
  });

  it('week가 달라도 fresh가 다루지 않는 worship_type은 보존한다', () => {
    // mergeWeeklySermonIntoCache(단일 이벤트 병합)와 달리, 이 함수는 "이 서버 응답이
    // 갱신해준 예배시간만 최신화"가 목적이라 주가 달라도 보존한다.
    const existing = [makeSermon('SUN_1150', 'old-sun1150', '2020-W01')];
    const fresh = [makeSermon('SAT_1700', 'new-sat', '2026-W40')];
    const merged = mergeFreshWeeklyResults(existing, fresh);
    expect(merged).toEqual(expect.arrayContaining([existing[0], fresh[0]]));
  });

  it('existing이 비어있으면 fresh만 반환한다', () => {
    const fresh = [makeSermon('SAT_1700', 'new-sat')];
    expect(mergeFreshWeeklyResults([], fresh)).toEqual(fresh);
  });
});

describe('mergeWeeklySermonIntoCache ([#306] iOS 대기열 병합)', () => {
  const ts = { seconds: 0, nanoseconds: 0 };
  const sermon = (overrides: Partial<Sermon>): Sermon => ({
    id: 'id', title: 'T', content: 'C', date: '2026-09-13',
    created_at: ts, updated_at: ts, ...overrides,
  });

  it('같은 week의 다른 worship_type 항목은 보존하고 같은 worship_type 항목은 교체한다', () => {
    const existing: Sermon[] = [
      sermon({ id: 'sat', week: '2026-W37', worship_type: 'SAT_1700' }),
      sermon({ id: 'sun0950-old', week: '2026-W37', worship_type: 'SUN_0950', title: 'old' }),
    ];
    const incoming = sermon({ id: 'sun0950-new', week: '2026-W37', worship_type: 'SUN_0950', title: 'new' });

    const result = mergeWeeklySermonIntoCache(existing, incoming);

    expect(result).toHaveLength(2);
    expect(result.find(s => s.worship_type === 'SAT_1700')?.id).toBe('sat');
    expect(result.find(s => s.worship_type === 'SUN_0950')?.title).toBe('new');
  });

  it('다른 week 항목은 모두 버린다', () => {
    const existing: Sermon[] = [
      sermon({ id: 'old-week', week: '2026-W36', worship_type: 'SUN_0950' }),
    ];
    const incoming = sermon({ id: 'new-week', week: '2026-W37', worship_type: 'SUN_1150' });

    const result = mergeWeeklySermonIntoCache(existing, incoming);

    expect(result).toEqual([incoming]);
  });

  it('빈 캐시에 처음 병합하면 새 항목 하나만 남는다', () => {
    const incoming = sermon({ id: 'first', week: '2026-W37', worship_type: 'SUN_0950' });
    expect(mergeWeeklySermonIntoCache([], incoming)).toEqual([incoming]);
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
