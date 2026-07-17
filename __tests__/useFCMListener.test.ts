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
  fetchLatestWeeklySermonsFromServer: jest.fn(),
  saveWeeklySermonsToAsyncStorage: jest.fn(),
  syncSelectedSermonToWidget: jest.fn(),
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
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('THU_EVE');
    const mockWeeklyList = [{ id: '1', date: '2026-07-19', worship_type: 'THU_EVE' }];
    (sermonService.fetchLatestWeeklySermonsFromServer as jest.Mock).mockResolvedValue(mockWeeklyList);
    (sermonService.saveWeeklySermonsToAsyncStorage as jest.Mock).mockResolvedValue(undefined);
    (sermonService.syncSelectedSermonToWidget as jest.Mock).mockResolvedValue(undefined);

    renderHook(() => useFCMListener(onUpdateMock));

    expect(capturedCallback).toBeDefined();

    // Simulate event trigger
    await capturedCallback();

    expect(sermonService.fetchLatestWeeklySermonsFromServer).toHaveBeenCalled();
    expect(sermonService.saveWeeklySermonsToAsyncStorage).toHaveBeenCalledWith(mockWeeklyList);
    expect(sermonService.syncSelectedSermonToWidget).toHaveBeenCalledWith('THU_EVE');
    expect(onUpdateMock).toHaveBeenCalled();
  });
});
