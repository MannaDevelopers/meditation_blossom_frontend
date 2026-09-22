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
  sermonFromLegacyEvent: jest.fn(),
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

  it('전체(ALL) 설정에서 sermons-v2 이벤트가 오면 화면 표시는 여전히 레거시 단일 문서 경로를 쓴다 ([#278])', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ALL');
    const legacySermon = { id: 'legacy-1', date: '2026-09-15' };
    (sermonService.fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({ week: '2026-W38', worship_type: 'SAT_1700', title: 'T' });

    expect(sermonService.fetchLatestSermonFromServer).toHaveBeenCalled();
    expect(sermonService.sermonFromLegacyEvent).not.toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).toHaveBeenCalledWith(legacySermon);
    expect(sermonService.pushSermonToWidget).toHaveBeenCalledWith(legacySermon);
    expect(sermonService.fetchLatestWeeklySermonsFromServer).not.toHaveBeenCalled();
    expect(onUpdateMock).toHaveBeenCalled();
  });

  // 레거시 sermon_events(_v2) payload는 그 자체로 화면에 필요한 내용을 다 담고 있어서
  // (docs/fcm-events/sermon-events.md), '전체' 옵션에서도 Firestore를 다시 읽지 않고
  // payload를 바로 반영해야 한다 — 예전엔 여기서 항상 Firestore를 재조회해서, 실제 서버가
  // Firestore에 쓰기 전엔(테스트 등) 화면이 갱신되지 않는 문제가 있었다.
  it('전체(ALL) 설정에서 레거시 sermon_events payload가 오면 Firestore 재조회 없이 바로 반영한다', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ALL');
    const converted = { id: 'src-1', title: '새 설교', date: '2026-09-22' };
    (sermonService.sermonFromLegacyEvent as jest.Mock).mockResolvedValue(converted);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({
      source_id: 'src-1',
      title: '새 설교',
      date: '2026-09-22',
      day_of_week: 'SUN',
      bible_references: '[]',
      operation: 'UPDATED',
    });

    expect(sermonService.sermonFromLegacyEvent).toHaveBeenCalled();
    expect(sermonService.fetchLatestSermonFromServer).not.toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).toHaveBeenCalledWith(converted);
    expect(sermonService.pushSermonToWidget).toHaveBeenCalledWith(converted);
  });

  // payload가 없거나 title/date조차 없는 진짜 빈 wake-up은 안전하게 Firestore 재조회로 폴백한다.
  it('전체(ALL) 설정에서 payload가 부족한 wake-up은 Firestore 재조회로 폴백한다', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ALL');
    const legacySermon = { id: 'legacy-1', date: '2026-09-15' };
    (sermonService.fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback();

    expect(sermonService.sermonFromLegacyEvent).not.toHaveBeenCalled();
    expect(sermonService.fetchLatestSermonFromServer).toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).toHaveBeenCalledWith(legacySermon);
  });

  // 전체 옵션에서 sermons-v2 이벤트를 완전히 무시하면, 나중에 특정 예배시간으로 설정을
  // 바꿨을 때 weekly_sermons 캐시가 그 사이 온 FCM을 못 받아 오래된 말씀을 보여줬다
  // (실사용자 리포트). 화면 표시는 레거시 경로를 쓰더라도 캐시는 항상 patch해둬야 한다.
  it('전체(ALL) 설정이어도 sermons-v2 이벤트는 weekly 캐시에 patch해둔다', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ALL');
    (sermonService.fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(null);
    const patched = { id: '2026-W38_SAT_1700', worship_type: 'SAT_1700' };
    (sermonService.upsertWeeklySermonFromEvent as jest.Mock).mockResolvedValue(patched);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({ week: '2026-W38', worship_type: 'SAT_1700', title: 'T' });

    expect(sermonService.upsertWeeklySermonFromEvent).toHaveBeenCalled();
    // 전체 옵션 화면 표시엔 여전히 patch 결과가 아니라 레거시 경로를 쓴다.
    expect(sermonService.saveSermonToAsyncStorage).not.toHaveBeenCalledWith(patched);
    expect(sermonService.pushSermonToWidget).not.toHaveBeenCalledWith(patched);
  });

  // '전체'가 아닌 특정 예배시간을 보는 중에도 레거시 sermon_events(_v2)가 오면 캐시는
  // 최신화해둬야 한다 — 안 그러면 나중에 '전체'로 설정을 바꿨을 때 Firestore가 아직
  // 갱신 전인 경우(테스트 등) 방금 온 최신 내용이 안 보인다. 다만 지금 화면(특정
  // 예배시간)과는 무관한 내용이므로 위젯은 갱신하지 않는다.
  it('특정 예배시간 설정에서 레거시 sermon_events payload가 오면 캐시만 최신화하고 위젯은 그대로 둔다', async () => {
    const onUpdateMock = jest.fn();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('SUN_0950');
    const converted = { id: 'src-1', title: '새 설교', date: '2026-09-22' };
    (sermonService.sermonFromLegacyEvent as jest.Mock).mockResolvedValue(converted);

    renderHook(() => useFCMListener(onUpdateMock));
    await capturedCallback({
      source_id: 'src-1',
      title: '새 설교',
      date: '2026-09-22',
      day_of_week: 'SUN',
      bible_references: '[]',
      operation: 'UPDATED',
    });

    expect(sermonService.sermonFromLegacyEvent).toHaveBeenCalled();
    expect(sermonService.fetchLatestWeeklySermonsFromServer).not.toHaveBeenCalled();
    expect(sermonService.saveSermonToAsyncStorage).toHaveBeenCalledWith(converted);
    expect(sermonService.pushSermonToWidget).not.toHaveBeenCalled();
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
