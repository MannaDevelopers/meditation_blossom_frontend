import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { APP_GROUP_DISPLAY_SERMON_KEY, APP_GROUP_POLL_INTERVAL_MS } from '../constants';
import { readAppGroupData, syncAppGroupToAsyncStorage } from '../services/sermonService';
import logger from '../utils/logger';
import { normalizeJsonString } from '../utils/normalize';

interface UseAppGroupSyncOptions {
  onDataSynced: () => Promise<void>;
  enabled: boolean;
}

export function useAppGroupSync({ onDataSynced, enabled }: UseAppGroupSyncOptions) {
  const lastSyncedSignatureRef = useRef<string | null>(null);

  const performInitialSync = useCallback(async () => {
    if (Platform.OS !== 'ios') return;

    try {
      const appGroupData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
      if (!appGroupData) return;

      const normalized = normalizeJsonString(appGroupData);
      const newSig = await syncAppGroupToAsyncStorage(appGroupData, null);
      if (newSig) {
        lastSyncedSignatureRef.current = newSig;
      } else {
        lastSyncedSignatureRef.current = normalized;
      }
    } catch (error) {
      logger.error('Error during initial App Group sync:', error);
    }
  }, []);

  // AppState listener + periodic polling
  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;

    const syncFromAppGroup = async () => {
      try {
        const appGroupData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
        if (!appGroupData) return;

        const newSig = await syncAppGroupToAsyncStorage(
          appGroupData,
          lastSyncedSignatureRef.current,
        );
        if (newSig) {
          lastSyncedSignatureRef.current = newSig;
          await onDataSynced();
        }
      } catch (error) {
        logger.error('Error syncing App Group data:', error);
        await onDataSynced();
      }
    };

    // Sync on foreground transitions
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncFromAppGroup();
      }
    });

    // If already active, sync now
    if (AppState.currentState === 'active') {
      syncFromAppGroup();
    }

    // Periodic polling (5s)
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        syncFromAppGroup();
      }
    }, APP_GROUP_POLL_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [enabled, onDataSynced]);

  return { performInitialSync };
}
