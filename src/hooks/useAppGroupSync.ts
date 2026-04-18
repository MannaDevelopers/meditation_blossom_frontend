import { useCallback } from 'react';
import { Platform } from 'react-native';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import { readAppGroupData, syncAppGroupToAsyncStorage } from '../services/sermonService';
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
      const appGroupData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
      if (!appGroupData) return;

      await syncAppGroupToAsyncStorage(appGroupData, null);
    } catch (error) {
      logger.error('Error during initial App Group sync:', error);
    }
  }, []);

  return { performInitialSync };
}
