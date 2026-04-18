import { act, renderHook } from '@testing-library/react-native';
import { useSermonData } from '../src/hooks/useSermonData';
import * as sermonService from '../src/services/sermonService';

jest.mock('../src/services/sermonService', () => ({
  fetchLatestSermonFromAsyncStorage: jest.fn(),
  fetchLatestSermonFromServer: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFetchFromAsyncStorage = sermonService.fetchLatestSermonFromAsyncStorage as jest.Mock;
const mockFetchFromServer = sermonService.fetchLatestSermonFromServer as jest.Mock;

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
});