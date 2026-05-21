import { act, renderHook } from '@testing-library/react-native';
import { useSermonData } from '../src/hooks/useSermonData';
import * as sermonService from '../src/services/sermonService';

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/sermonService', () => ({
  fetchLatestSermonFromAsyncStorage: jest.fn(),
  fetchLatestSermonFromServer: jest.fn(),
  saveSermonToAsyncStorage: jest.fn(),
  subscribeToLatestSermon: jest.fn(() => jest.fn()), // returns unsubscribe fn
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFetchFromAsyncStorage = sermonService.fetchLatestSermonFromAsyncStorage as jest.Mock;
const mockFetchFromServer = sermonService.fetchLatestSermonFromServer as jest.Mock;
const mockSaveSermonToAsyncStorage = sermonService.saveSermonToAsyncStorage as jest.Mock;
const mockSubscribeToLatestSermon = sermonService.subscribeToLatestSermon as jest.Mock;

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
    it('서버에서 데이터 오면 sermon 세팅됨', async () => {
      mockFetchFromServer.mockResolvedValue(mockSermon);
      const { result } = renderHook(() => useSermonData());

      await act(async () => {
        await result.current.fetchFromServer();
      });

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
});