import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import {
  fetchLatestWeeklySermonsFromAsyncStorage,
  fetchLegacySermonFromCache,
  mergeWeeklySermonIntoCache,
  readAppGroupData,
  saveLegacySermonToCache,
  saveWeeklySermonsToAsyncStorage,
  syncAppGroupToAsyncStorage,
  WEEKLY_SERMONS_PENDING_KEY,
} from '../services/sermonService';
import { compareSermon, fcmDataToSermon, LEGACY_SERMON_CACHE_KEY, Sermon, SermonRaw } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
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

      // sermons-v2 대기열 병합([#306]): 앱 종료 상태에서 NotificationService/AppDelegate이
      // App Group에 쌓아둔 항목을 weekly_sermons 캐시로 병합하고 대기열을 비운다. 네이티브가
      // 현재 설정과 일치하는 항목은 이미 fcm_sermon/displaySermon(위 동기화 대상)에 반영해뒀으므로,
      // 여기서는 나중에 다른 예배시간으로 전환했을 때 바로 보이도록 캐시만 채워두면 된다.
      const pendingRaw = await readAppGroupData(WEEKLY_SERMONS_PENDING_KEY);
      if (pendingRaw) {
        try {
          const pendingEntries = JSON.parse(pendingRaw) as Sermon[];
          if (Array.isArray(pendingEntries) && pendingEntries.length > 0) {
            let weekly = await fetchLatestWeeklySermonsFromAsyncStorage();
            for (const entry of pendingEntries) {
              weekly = mergeWeeklySermonIntoCache(weekly, entry);
            }
            await saveWeeklySermonsToAsyncStorage(weekly);
            logger.log(`useAppGroupSync: Merged ${pendingEntries.length} pending weekly sermon(s)`);
          }
        } catch {
          logger.warn('useAppGroupSync: weekly_sermons_pending App Group 데이터가 유효한 JSON이 아님, 건너뜀');
        }
        if (WidgetUpdateModule) {
          await WidgetUpdateModule.removeAppGroupData(WEEKLY_SERMONS_PENDING_KEY);
        }
      }

      // legacy 캐시 재조정([#307]): '전체'가 아닐 때 받은 레거시 payload는 App Group
      // legacy_sermon_cache에만 저장돼 있다 — 로컬 AsyncStorage 캐시와 비교해 더 최신인
      // 쪽을 남긴다(SettingsScreen.fetchReconciledLegacySermon과 동일한 비교 규칙).
      const legacyAppGroupData = await readAppGroupData(LEGACY_SERMON_CACHE_KEY);
      if (legacyAppGroupData) {
        try {
          const fromAppGroup = fcmDataToSermon(JSON.parse(legacyAppGroupData) as SermonRaw);
          const cached = await fetchLegacySermonFromCache();
          if (compareSermon(fromAppGroup, cached) > 0) {
            await saveLegacySermonToCache(fromAppGroup);
            logger.log('useAppGroupSync: Reconciled legacy sermon cache from App Group');
          }
        } catch {
          logger.warn('useAppGroupSync: legacy_sermon_cache App Group 데이터가 유효한 JSON이 아님, 건너뜀');
        }
      }
    } catch (error) {
      logger.error('Error during initial App Group sync:', error);
    }
  }, []);

  return { performInitialSync };
}
