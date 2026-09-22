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
      const isWeeklyEvent = Boolean(event?.week && event?.worship_type);

      // sermons-v2 단일 문서 이벤트는 '전체' 옵션이어도 weekly_sermons 캐시에 patch해둔다.
      // 예전엔 '전체'일 때 이 이벤트를 통째로 무시했는데, 그러면 나중에 특정 예배시간으로
      // 설정을 바꿨을 때 캐시가 그 사이 온 FCM을 못 받아 오래된 말씀이 그대로 보였다
      // (실사용자 리포트로 발견). 화면 표시(아래 분기)는 그대로 '전체'면 레거시 경로를
      // 쓰고, 캐시 patch만 항상 해둔다.
      const patched = isWeeklyEvent
        ? await upsertWeeklySermonFromEvent(event as SermonRaw)
        : null;

      if (worshipSetting === 'ALL') {
        // 전체 옵션 화면 표시: 레거시 단일 최신 문서 경로 그대로 사용([#278])
        const legacy = await fetchLatestSermonFromServer();
        if (legacy) {
          await saveSermonToAsyncStorage(legacy);
          await pushSermonToWidget(legacy);
        }
      } else if (isWeeklyEvent) {
        // sermons-v2 단일 문서 이벤트: 전체 재조회 없이 위에서 patch한 결과만 반영([#280])
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
