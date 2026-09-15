import { renderHook } from '@testing-library/react-native';
import { useFCMListener } from '../src/hooks/useFCMListener';
import { NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as sermonService from '../src/services/sermonService';
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../src/services/sermonService', () => ({
  readAppGroupData: jest.fn(),
  syncAppGroupToAsyncStorage: jest.fn(),
  fetchLatestSermonFromServer: jest.fn(),
  fetchLatestWeeklySermonsFromServer: jest.fn(),
  saveSermonToAsyncStorage: jest.fn(),
  saveWeeklySermonsToAsyncStorage: jest.fn(),
  syncSelectedSermonToWidget: jest.fn(),
  pushSermonToWidget: jest.fn(),
  upsertWeeklySermonFromEvent: jest.fn(),
}));

describe('useFCMListener', () => {
  let capturedCallback: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const emitterMock = require('react-native/Libraries/EventEmitter/NativeEventEmitter').default;
    NativeModules.MyEventModule = {};
    emitterMock.mockImplementation(() => ({
      addListener: jest.fn((event: string, callback: any) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));
  });

  it('subscribes to ON_SERMON_UPDATE and fetches weekly sermons on event', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('SAT_1700');
    const mockWeeklyList = [{ id: '1', date: '2026-09-12', week: '2026-W37', worship_type: 'SAT_1700' }];
    (sermonService.fetchLatestWeeklySermonsFromServer as jest.Mock).mockResolvedValue(mockWeeklyList);
    (sermonService.saveWeeklySermonsToAsyncStorage as jest.Mock).mockResolvedValue(undefined);
    (sermonService.syncSelectedSermonToWidget as jest.Mock).mockResolvedValue(undefined);

    renderHook(() => useFCMListener(onUpdateMock));

    expect(capturedCallback).toBeDefined();

    // Simulate event trigger
    await capturedCallback();

    expect(sermonService.fetchLatestWeeklySermonsFromServer).toHaveBeenCalled();
    expect(sermonService.saveWeeklySermonsToAsyncStorage).toHaveBeenCalledWith(mockWeeklyList);
    expect(sermonService.syncSelectedSermonToWidget).toHaveBeenCalledWith('SAT_1700');
    expect(onUpdateMock).toHaveBeenCalled();
  });

  it('전체(ALL) 설정이면 event 데이터와 무관하게 레거시 단일 문서 경로를 사용한다 ([#278])', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ALL');
    const legacySermon = { id: 'legacy-1', date: '2026-09-15' };
    (sermonService.fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({ week: '2026-W38', worship_type: 'SAT_1700', title: 'T' });

    expect(sermonService.fetchLatestSermonFromServer).toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).toHaveBeenCalledWith(legacySermon);
    expect(sermonService.pushSermonToWidget).toHaveBeenCalledWith(legacySermon);
    expect(sermonService.fetchLatestWeeklySermonsFromServer).not.toHaveBeenCalled();
    expect(sermonService.upsertWeeklySermonFromEvent).not.toHaveBeenCalled();
    expect(onUpdateMock).toHaveBeenCalled();
  });

  it('event에 week/worship_type이 있으면 전체 재조회 없이 단일 문서만 patch한다 ([#280])', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('SAT_1700');
    const patched = { id: '2026-W38_SAT_1700', worship_type: 'SAT_1700', video_url: 'https://youtu.be/new' };
    (sermonService.upsertWeeklySermonFromEvent as jest.Mock).mockResolvedValue(patched);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({ week: '2026-W38', worship_type: 'SAT_1700', title: 'T', operation: 'UPDATED' });

    expect(sermonService.upsertWeeklySermonFromEvent).toHaveBeenCalled();
    expect(sermonService.fetchLatestWeeklySermonsFromServer).not.toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).toHaveBeenCalledWith(patched);
    expect(sermonService.pushSermonToWidget).toHaveBeenCalledWith(patched);
  });

  it('patch된 문서가 현재 선택된 예배와 다르면 위젯을 갱신하지 않는다', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('SUN_0950');
    const patched = { id: '2026-W38_SAT_1700', worship_type: 'SAT_1700', video_url: 'https://youtu.be/new' };
    (sermonService.upsertWeeklySermonFromEvent as jest.Mock).mockResolvedValue(patched);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({ week: '2026-W38', worship_type: 'SAT_1700', title: 'T', operation: 'UPDATED' });

    expect(sermonService.upsertWeeklySermonFromEvent).toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).not.toHaveBeenCalled();
    expect(sermonService.pushSermonToWidget).not.toHaveBeenCalled();
  });
});
