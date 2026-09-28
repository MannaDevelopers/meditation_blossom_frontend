import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSermonData } from '../src/hooks/useSermonData';
import * as sermonService from '../src/services/sermonService';

// 파일 로드 시점(어떤 테스트도 jest.setSystemTime을 호출하기 전)에 실제 현재 시각을 캡처해둔다.
// 이 값을 캡처한 뒤 jest.setSystemTime으로 시각을 조작하면, 테스트 안에서 새로 만드는
// `new Date()`는 실제 시각이 아니라 조작된 가짜 시각을 반환하므로 복원용으로 쓸 수 없다.
const REAL_NOW = new Date();

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/sermonService', () => ({
  fetchLatestSermonFromAsyncStorage: jest.fn(),
  fetchLatestSermonFromServer: jest.fn(),
  saveSermonToAsyncStorage: jest.fn(),
  subscribeToLatestSermon: jest.fn(() => jest.fn()), // returns unsubscribe fn
  fetchLatestWeeklySermonsFromAsyncStorage: jest.fn(),
  saveWeeklySermonsToAsyncStorage: jest.fn(),
  fetchLatestWeeklySermonsFromServer: jest.fn(),
  pushSermonToWidget: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFetchFromAsyncStorage = sermonService.fetchLatestSermonFromAsyncStorage as jest.Mock;
const mockFetchFromServer = sermonService.fetchLatestSermonFromServer as jest.Mock;
const mockSaveSermonToAsyncStorage = sermonService.saveSermonToAsyncStorage as jest.Mock;
const mockSubscribeToLatestSermon = sermonService.subscribeToLatestSermon as jest.Mock;
const mockFetchWeeklyFromAsyncStorage = sermonService.fetchLatestWeeklySermonsFromAsyncStorage as jest.Mock;
const mockSaveWeeklyToAsyncStorage = sermonService.saveWeeklySermonsToAsyncStorage as jest.Mock;
const mockFetchWeeklyFromServer = sermonService.fetchLatestWeeklySermonsFromServer as jest.Mock;
const mockPushSermonToWidget = sermonService.pushSermonToWidget as jest.Mock;

const mockSermon = {
  id: 'test-1',
  title: '테스트 설교',
  content: '설교 내용',
  date: '2025-04-13',
  day_of_week: 'SUN',
  created_at: { seconds: 0, nanoseconds: 0 },
  updated_at: { seconds: 0, nanoseconds: 0 },
};

describe('useSermonData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('isLoading true, sermon null, error null로 시작', () => {
      mockFetchFromAsyncStorage.mockResolvedValue(null);
      const { result } = renderHook(() => useSermonData());
      expect(result.current.isLoading).toBe(true);
      expect(result.current.sermon).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('loadLocalData', () => {
    it('AsyncStorage에 값 있으면 sermon 세팅됨', async () => {
      mockFetchFromAsyncStorage.mockResolvedValue(mockSermon);
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.loadLocalData();
      });

      expect(result.current.sermon).toEqual(mockSermon);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('AsyncStorage 비어있으면 sermon null, isLoading false', async () => {
      mockFetchFromAsyncStorage.mockResolvedValue(null);
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.loadLocalData();
      });

      expect(result.current.sermon).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('AsyncStorage 에러 시 error 상태 세팅됨', async () => {
      mockFetchFromAsyncStorage.mockRejectedValue(new Error('storage fail'));
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.loadLocalData();
      });

      expect(result.current.error).toBe('storage fail');
      expect(result.current.isLoading).toBe(false);
    });

    it('AsyncStorage 에러 시 sermon은 null 유지됨', async () => {
      mockFetchFromAsyncStorage.mockRejectedValue(new Error('storage fail'));
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.loadLocalData();
      });

      expect(result.current.sermon).toBeNull();
    });
  });

  describe('fetchFromServer', () => {
    it('서버에서 데이터 오면 AsyncStorage 저장 후 sermon 세팅됨', async () => {
      mockFetchFromServer.mockResolvedValue(mockSermon);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.fetchFromServer();
      });

      expect(mockSaveSermonToAsyncStorage).toHaveBeenCalledWith(mockSermon);
      expect(result.current.sermon).toEqual(mockSermon);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('서버가 null 반환하면 기존 sermon 유지됨', async () => {
      mockFetchFromAsyncStorage.mockResolvedValue(mockSermon);
      mockFetchFromServer.mockResolvedValue(null);
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.loadLocalData();
      });
      await act(async () => {
        await result.current.fetchFromServer();
      });

      expect(result.current.sermon).toEqual(mockSermon);
    });

    it('서버 에러 시 error 상태 세팅됨', async () => {
      mockFetchFromServer.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.fetchFromServer();
      });

      expect(result.current.error).toBe('network error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('onRefresh', () => {
    it('onRefresh 호출 시 fetchFromServer 실행됨', async () => {
      mockFetchFromServer.mockResolvedValue(mockSermon);
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.onRefresh();
      });

      expect(mockFetchFromServer).toHaveBeenCalledTimes(1);
      expect(result.current.sermon).toEqual(mockSermon);
    });
  });

  describe('loadLocalData video_url 보충 (forced fetch)', () => {
    const localNoVideo = {
      id: 's1',
      title: '설교',
      content: '본문 내용',
      date: '2026-06-13',
      created_at: { seconds: 0, nanoseconds: 0 },
      updated_at: { seconds: 1000, nanoseconds: 0 },
    };

    it('로컬에 video_url이 없으면 서버에서 보충해 채운다', async () => {
      const serverWithVideo = { ...localNoVideo, video_url: 'https://youtu.be/abc' };
      mockFetchFromAsyncStorage.mockResolvedValue(localNoVideo);
      mockFetchFromServer.mockResolvedValue(serverWithVideo);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });

      expect(mockFetchFromServer).toHaveBeenCalledTimes(1);
      expect(result.current.sermon?.video_url).toBe('https://youtu.be/abc');
      expect(mockSaveSermonToAsyncStorage).toHaveBeenCalled();
    });

    it('video_url이 이미 있으면 서버 보충 조회를 하지 않는다', async () => {
      // '전체' 설정으로 고정 — weekly 캐시 미스로 인한 마이그레이션 강제 조회([#289])와
      // 섞이지 않도록, 이 테스트는 순수하게 video_url 유무만으로 판단하는 경로를 검증한다.
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('ALL');
        return Promise.resolve(null);
      });
      const localWithVideo = { ...localNoVideo, video_url: 'https://youtu.be/zzz' };
      mockFetchFromAsyncStorage.mockResolvedValue(localWithVideo);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });

      expect(mockFetchFromServer).not.toHaveBeenCalled();
      expect(result.current.sermon).toEqual(localWithVideo);
    });

    it('보충 조회는 세션당 1회만 시도한다 (반복 호출해도 추가 조회 없음)', async () => {
      mockFetchFromAsyncStorage.mockResolvedValue(localNoVideo);
      mockFetchFromServer.mockResolvedValue(null); // 서버에도 없음 → 못 채움

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });
      await act(async () => { await result.current.loadLocalData(); });
      await act(async () => { await result.current.loadLocalData(); });

      expect(mockFetchFromServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToLatestSermon (onSnapshot)', () => {
    const olderSermon = {
      id: 'older-1',
      title: '이전 설교',
      content: '내용',
      date: '2025-04-06',
      created_at: { seconds: 1000, nanoseconds: 0 },
      updated_at: { seconds: 1000, nanoseconds: 0 },
    };
    const newerSermon = {
      id: 'newer-1',
      title: '최신 설교',
      content: '내용',
      date: '2025-05-18',
      created_at: { seconds: 2000, nanoseconds: 0 },
      updated_at: { seconds: 2000, nanoseconds: 0 },
    };

    it('마운트 시 subscribeToLatestSermon 호출됨', () => {
      renderHook(() => useSermonData());
      expect(mockSubscribeToLatestSermon).toHaveBeenCalledTimes(1);
    });

    it('언마운트 시 unsubscribe 함수 호출됨', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeToLatestSermon.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useSermonData());
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('더 최신 sermon이 오면 AsyncStorage 저장 후 상태 업데이트', async () => {
      let capturedOnUpdate: (sermon: typeof newerSermon) => Promise<void>;
      mockSubscribeToLatestSermon.mockImplementation((onUpdate: typeof capturedOnUpdate) => {
        capturedOnUpdate = onUpdate;
        return jest.fn();
      });
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);
      mockFetchFromAsyncStorage.mockResolvedValue(olderSermon);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });
      await act(async () => { await capturedOnUpdate(newerSermon); });

      expect(mockSaveSermonToAsyncStorage).toHaveBeenCalledWith(newerSermon);
      expect(result.current.sermon).toEqual(newerSermon);
    });

    it('동일하거나 이전 sermon이 오면 상태 유지', async () => {
      let capturedOnUpdate: (sermon: typeof olderSermon) => Promise<void>;
      mockSubscribeToLatestSermon.mockImplementation((onUpdate: typeof capturedOnUpdate) => {
        capturedOnUpdate = onUpdate;
        return jest.fn();
      });
      mockFetchFromAsyncStorage.mockResolvedValue(newerSermon);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });
      await act(async () => { await capturedOnUpdate(olderSermon); });

      expect(mockSaveSermonToAsyncStorage).not.toHaveBeenCalled();
      expect(result.current.sermon).toEqual(newerSermon);
    });
  });

  describe('worship time selection integration', () => {
    const mockWeeklyList = [
      { id: 'sat', title: 'Sat Sermon', content: 'C', date: '2026-09-12', week: '2026-W37', worship_type: 'SAT_1700' as any, created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } },
      { id: 'sun', title: 'Sun Sermon', content: 'C', date: '2026-09-13', week: '2026-W37', worship_type: 'SUN_0950' as any, created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 } }
    ];

    beforeEach(() => {
      // Mock AsyncStorage user_worship_setting
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('SAT_1700');
        return Promise.resolve(null);
      });
    });

    // 아래 두 테스트는 "지금"을 명시적으로 고정해야 예배 시각 경계를 안정적으로 재현할 수
    // 있다(실제 실행 시각에 의존하면 나중에 테스트가 깨진다). 다른 테스트에 영향을 주지 않도록
    // 매번 실제 현재 시각으로 복원한다.
    afterEach(() => {
      jest.setSystemTime(REAL_NOW);
    });

    it('포그라운드 경계 감시: 예배 시각을 넘기면 새 FCM 없이도 자동으로 화면/위젯을 갱신한다 ([ISSUE-315])', async () => {
      // SAT_1700(2026-W37) = 2026-09-12 17:00. 경계 1분 전에서 시작한다.
      jest.setSystemTime(new Date(2026, 8, 12, 16, 59, 0));
      const olderSermonV2 = {
        id: 'old', title: '이전 예배', content: '내용', date: '2026-09-06', week: '2026-W36',
        worship_type: 'SAT_1700' as any, created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
      };
      const arrivedSermon = {
        id: 'new', title: '이번 주 예배', content: '내용', date: '2026-09-12', week: '2026-W37',
        worship_type: 'SAT_1700' as any, created_at: { seconds: 1, nanoseconds: 0 }, updated_at: { seconds: 1, nanoseconds: 0 },
      };
      mockFetchFromAsyncStorage.mockResolvedValue(olderSermonV2);
      mockFetchWeeklyFromAsyncStorage.mockResolvedValue([arrivedSermon]);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });
      // 아직 16:59이므로 예배 시각 전 — 이전 콘텐츠를 유지해야 한다.
      expect(result.current.sermon).toEqual(olderSermonV2);

      await act(async () => {
        // 16:59 -> 17:00, 경계를 정확히 넘긴다.
        jest.advanceTimersByTime(60000);
        // setInterval 콜백 내부의 비동기 작업(AsyncStorage/캐시 조회)이 마이크로태스크로
        // 대기 중이므로 한 틱 더 흘려보낸다.
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockSaveSermonToAsyncStorage).toHaveBeenCalledWith(arrivedSermon);
      expect(mockPushSermonToWidget).toHaveBeenCalledWith(arrivedSermon);
      expect(result.current.sermon).toEqual(arrivedSermon);
    });

    it('포그라운드 경계 감시: 아직 예배 시각이 안 됐으면 기존 콘텐츠를 유지한다', async () => {
      // SAT_1700(2026-W37) = 2026-09-12 17:00. 1시간 전에서 시작해 1분만 흘려보낸다(여전히 전).
      jest.setSystemTime(new Date(2026, 8, 12, 16, 0, 0));
      const olderSermonV2 = {
        id: 'old', title: '이전 예배', content: '내용', date: '2026-09-06', week: '2026-W36',
        worship_type: 'SAT_1700' as any, created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
      };
      const notYetArrivedSermon = {
        id: 'future', title: '이번 주 예배', content: '내용', date: '2026-09-12', week: '2026-W37',
        worship_type: 'SAT_1700' as any, created_at: { seconds: 1, nanoseconds: 0 }, updated_at: { seconds: 1, nanoseconds: 0 },
      };
      mockFetchFromAsyncStorage.mockResolvedValue(olderSermonV2);
      mockFetchWeeklyFromAsyncStorage.mockResolvedValue([notYetArrivedSermon]);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });

      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockSaveSermonToAsyncStorage).not.toHaveBeenCalled();
      expect(mockPushSermonToWidget).not.toHaveBeenCalled();
      expect(result.current.sermon).toEqual(olderSermonV2);
    });

    it('loads selected worship sermon from weekly list cache', async () => {
      mockFetchWeeklyFromAsyncStorage.mockResolvedValue(mockWeeklyList);

      const { result } = renderHook(() => useSermonData());
      await act(async () => {
        await result.current.loadLocalData();
      });

      expect(result.current.sermon).toEqual(mockWeeklyList[0]); // should be Saturday sermon
    });

    it('falls back to legacy fcm_sermon if weekly cache is empty', async () => {
      mockFetchWeeklyFromAsyncStorage.mockResolvedValue([]);
      mockFetchFromAsyncStorage.mockResolvedValue(mockSermon);

      const { result } = renderHook(() => useSermonData());
      await act(async () => {
        await result.current.loadLocalData();
      });

      expect(result.current.sermon).toEqual(mockSermon);
    });

    it('마이그레이션: 레거시 캐시에 video_url/content가 이미 있어도 weekly 캐시 미스면 서버 데이터로 교체한다 (실사용자 리포트)', async () => {
      const legacySermonWithEverything = {
        id: 'legacy-1', title: 'Legacy', content: '기존 내용', date: '2026-08-01',
        video_url: 'https://youtu.be/legacy',
        created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
      };
      mockFetchWeeklyFromAsyncStorage.mockResolvedValue([]); // 아직 sermons-v2 캐시를 받은 적 없음
      mockFetchFromAsyncStorage.mockResolvedValue(legacySermonWithEverything);
      mockFetchWeeklyFromServer.mockResolvedValue(mockWeeklyList); // 설정된 SAT_1700이 이 안에 있음
      mockSaveWeeklyToAsyncStorage.mockResolvedValue(undefined);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSermonData());
      await act(async () => {
        await result.current.loadLocalData();
      });

      // video_url/content가 이미 채워져 있었으므로 예전 로직이면 서버 조회를 안 했을 것이다.
      expect(mockFetchWeeklyFromServer).toHaveBeenCalled();
      // 레거시 데이터가 아니라 서버에서 받은 SAT_1700 매칭 데이터로 교체돼야 한다.
      expect(result.current.sermon).toEqual(mockWeeklyList[0]);
    });

    it('fetches weekly sermons list from server and saves them', async () => {
      mockFetchWeeklyFromServer.mockResolvedValue(mockWeeklyList);
      mockSaveWeeklyToAsyncStorage.mockResolvedValue(undefined);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);
      mockPushSermonToWidget.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSermonData());
      await act(async () => {
        await result.current.fetchFromServer();
      });

      expect(mockFetchWeeklyFromServer).toHaveBeenCalled();
      expect(mockSaveWeeklyToAsyncStorage).toHaveBeenCalledWith(mockWeeklyList);
      expect(result.current.sermon).toEqual(mockWeeklyList[0]); // matching Thursday
    });

    it('[ISSUE-315] 서버 응답에 설정과 일치하는 예배가 없으면 다른 예배시간의 콘텐츠를 새치기하지 않고 기존 콘텐츠를 유지한다 (실사용자 리포트)', async () => {
      // 설정은 SAT_1700(이 describe의 beforeEach). 먼저 이미 도달한 SAT_1700 콘텐츠를 로컬
      // 캐시에서 로드해 "지금 화면에 표시 중"인 상태를 만든다(video_url/content가 이미 있어
      // loadLocalData의 서버 강제 보충 분기를 타지 않게 함).
      const alreadyDisplayed = {
        id: 'sat-old', title: '이전에 보여주던 토요 예배', content: '내용', date: '2026-09-06',
        week: '2026-W36', worship_type: 'SAT_1700' as any, video_url: 'https://youtu.be/old',
        created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 0, nanoseconds: 0 },
      };
      mockFetchWeeklyFromAsyncStorage.mockResolvedValue([alreadyDisplayed]);
      mockFetchFromAsyncStorage.mockResolvedValue(alreadyDisplayed);

      const { result } = renderHook(() => useSermonData());
      await act(async () => {
        await result.current.loadLocalData();
      });
      expect(result.current.sermon).toEqual(alreadyDisplayed);

      // 이제 서버 응답엔 SAT_1700이 없고 SUN_0950만 있다 — 예전 폴백(weeklyResults[0])이
      // 있으면 무관한 SUN_0950 콘텐츠로 화면이 바뀌어버렸다.
      const noMatchList = [mockWeeklyList[1]]; // SUN_0950만 있음, SAT_1700 없음
      mockFetchWeeklyFromServer.mockResolvedValue(noMatchList);
      mockSaveWeeklyToAsyncStorage.mockResolvedValue(undefined);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);
      mockPushSermonToWidget.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.fetchFromServer();
      });

      expect(mockSaveWeeklyToAsyncStorage).toHaveBeenCalledWith(noMatchList);
      expect(result.current.sermon).toEqual(alreadyDisplayed);
      expect(result.current.sermon?.worship_type).not.toBe('SUN_0950');
    });
  });

  describe('전체(ALL) 설정 — 레거시 경로 ([#278])', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('ALL');
        return Promise.resolve(null);
      });
    });

    it('loadLocalData: 주간 캐시를 조회하지 않고 레거시 단일 문서를 그대로 사용한다', async () => {
      mockFetchFromAsyncStorage.mockResolvedValue(mockSermon);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });

      expect(mockFetchWeeklyFromAsyncStorage).not.toHaveBeenCalled();
      expect(result.current.sermon).toEqual(mockSermon);
    });

    it('fetchFromServer: sermons-v2 주간 조회 없이 레거시 서버 조회만 한다', async () => {
      mockFetchFromServer.mockResolvedValue(mockSermon);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.fetchFromServer(); });

      expect(mockFetchWeeklyFromServer).not.toHaveBeenCalled();
      expect(mockFetchFromServer).toHaveBeenCalled();
      expect(mockPushSermonToWidget).toHaveBeenCalledWith(mockSermon);
      expect(result.current.sermon).toEqual(mockSermon);
    });

    it('onSnapshot: 새 레거시 문서를 주간 재조회 없이 그대로 반영한다', async () => {
      let capturedOnUpdate: (sermon: typeof mockSermon) => Promise<void>;
      mockSubscribeToLatestSermon.mockImplementation((onUpdate: typeof capturedOnUpdate) => {
        capturedOnUpdate = onUpdate;
        return jest.fn();
      });
      mockFetchFromAsyncStorage.mockResolvedValue(null);
      mockSaveSermonToAsyncStorage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSermonData());
      await act(async () => { await result.current.loadLocalData(); });
      await act(async () => { await capturedOnUpdate(mockSermon); });

      expect(mockFetchWeeklyFromServer).not.toHaveBeenCalled();
      expect(mockPushSermonToWidget).toHaveBeenCalledWith(mockSermon);
      expect(result.current.sermon).toEqual(mockSermon);
    });
  });
});