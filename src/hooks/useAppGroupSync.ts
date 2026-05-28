import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import { readAppGroupData, syncAppGroupToAsyncStorage } from '../services/sermonService';
import { FCM_QT_KEY } from '../types/QT';
import logger from '../utils/logger';

interface UseAppGroupSyncOptions {
  onDataSynced: () => Promise<unknown>;
  enabled: boolean;
}

// iOS 앱 완전 종료 후 재시작 시 App Group → AsyncStorage 동기화 전용
// NotificationService(Extension)가 sandbox 제약으로 AsyncStorage 직접 저장 불가하므로
// 앱 재시작 1회 실행만 유지. 포그라운드/백그라운드 FCM 수신은 AppDelegate.mm이 직접 저장.
export function useAppGroupSync({ onDataSynced: _onDataSynced, enabled: _enabled }: UseAppGroupSyncOptions) {
  const performInitialSync = useCallback(async () => {
    if (Platform.OS !== 'ios') return;

    try {
      // Sermon 동기화: App Group displaySermon → AsyncStorage fcm_sermon
      const sermonData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
      if (sermonData) {
        await syncAppGroupToAsyncStorage(sermonData, null);
      }

      // QT 동기화: App Group fcm_qt → AsyncStorage fcm_qt
      // NotificationService(Extension)는 sandbox 제약으로 AsyncStorage 직접 저장 불가하므로
      // 앱 완전 종료 후 재시작 시 App Group 데이터를 복사
      const qtData = await readAppGroupData(FCM_QT_KEY);
      if (qtData) {
        try {
          JSON.parse(qtData); // 유효한 JSON인지 검증
          await AsyncStorage.setItem(FCM_QT_KEY, qtData);
          logger.log('useAppGroupSync: Synced App Group fcm_qt to AsyncStorage');
        } catch {
          logger.warn('useAppGroupSync: fcm_qt App Group 데이터가 유효한 JSON이 아님, 건너뜀');
        }
      }
    } catch (error) {
      logger.error('Error during initial App Group sync:', error);
    }
  }, []);

  return { performInitialSync };
}
