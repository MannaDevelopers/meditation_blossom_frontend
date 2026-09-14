import { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import {
  readAppGroupData,
  syncAppGroupToAsyncStorage,
  fetchLatestWeeklySermonsFromServer,
  saveWeeklySermonsToAsyncStorage,
  syncSelectedSermonToWidget,
} from '../services/sermonService';
import { WorshipType, USER_WORSHIP_SETTING_KEY, DEFAULT_WORSHIP_TYPE } from '../types/Sermon';
import logger from '../utils/logger';

export function useFCMListener(onUpdate: () => void | Promise<unknown>): void {
  const onEventReceived = useCallback(async () => {
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
      const weekly = await fetchLatestWeeklySermonsFromServer();
      if (weekly && weekly.length > 0) {
        await saveWeeklySermonsToAsyncStorage(weekly);
        const worshipSetting = (await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipType || DEFAULT_WORSHIP_TYPE;
        await syncSelectedSermonToWidget(worshipSetting);
      }
    } catch (e) {
      logger.error('useFCMListener: Failed to fetch and sync weekly sermons on FCM update', e);
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
