import { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import {
  readAppGroupData,
  syncAppGroupToAsyncStorage,
  fetchLatestSermonFromServer,
  fetchLatestWeeklySermonsFromServer,
  saveSermonToAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  syncSelectedSermonToWidget,
  pushSermonToWidget,
  upsertWeeklySermonFromEvent,
} from '../services/sermonService';
import { SermonRaw, WorshipSetting, USER_WORSHIP_SETTING_KEY, DEFAULT_WORSHIP_TYPE } from '../types/Sermon';
import logger from '../utils/logger';

// 네이티브가 sermons-v2 이벤트일 때만 원본 FCM data(week/worship_type 등)를 실어 보낸다.
// 레거시 sermon_events_v2 wake-up은 params 없이(undefined) 온다.
type SermonUpdateEvent = Partial<SermonRaw> & { operation?: string };

export function useFCMListener(onUpdate: () => void | Promise<unknown>): void {
  const onEventReceived = useCallback(async (event?: SermonUpdateEvent) => {
    logger.log(`${Platform.OS} FCM sermon update received`);
    // iOS: AppDelegate이 App Group에 올바르게 저장했으므로,
    // AsyncStorage(JS)에 동기화한 뒤 loadLocalData를 호출해 즉시 최신 데이터를 표시
    if (Platform.OS === 'ios') {
      try {
        const appGroupData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
        if (appGroupData) {
          await syncAppGroupToAsyncStorage(appGroupData, null);
        }
      } catch (e) {
        logger.warn('useFCMListener: App Group displaySermon이 유효한 JSON이 아님, 건너뜀');
      }
    }

    try {
      const worshipSetting =
        ((await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipSetting) || DEFAULT_WORSHIP_TYPE;

      if (worshipSetting === 'ALL') {
        // 전체 옵션: 레거시 단일 최신 문서 경로 그대로 사용, sermons-v2 이벤트 데이터는 무관([#278])
        const legacy = await fetchLatestSermonFromServer();
        if (legacy) {
          await saveSermonToAsyncStorage(legacy);
          await pushSermonToWidget(legacy);
        }
      } else if (event?.week && event?.worship_type) {
        // sermons-v2 단일 문서 이벤트: 전체 재조회 없이 캐시 한 건만 patch([#280])
        const patched = await upsertWeeklySermonFromEvent(event as SermonRaw);
        if (patched && patched.worship_type === worshipSetting) {
          await saveSermonToAsyncStorage(patched);
          await pushSermonToWidget(patched);
        }
      } else {
        // payload 정보가 없는 wake-up(레거시 토픽 등) → 폴백으로 전체 재조회
        const weekly = await fetchLatestWeeklySermonsFromServer();
        if (weekly && weekly.length > 0) {
          await saveWeeklySermonsToAsyncStorage(weekly);
          await syncSelectedSermonToWidget(worshipSetting);
        }
      }
    } catch (e) {
      logger.error('useFCMListener: Failed to sync sermon data on FCM update', e);
    }

    await onUpdate();
  }, [onUpdate]);

  useEffect(() => {
    const { MyEventModule } = NativeModules;

    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }

    const eventEmitter = new NativeEventEmitter(MyEventModule);
    const subscription = eventEmitter.addListener('ON_SERMON_UPDATE', onEventReceived);

    return () => {
      subscription.remove();
    };
  }, [onEventReceived]);
}
