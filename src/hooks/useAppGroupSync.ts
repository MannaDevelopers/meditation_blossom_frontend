import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import { readAppGroupData, syncAppGroupToAsyncStorage } from '../services/sermonService';
import logger from '../utils/logger';

interface UseAppGroupSyncOptions {
  onDataSynced: () => Promise<unknown>;
  enabled: boolean;
}

export function useAppGroupSync({ onDataSynced, enabled }: UseAppGroupSyncOptions) {
  const lastSyncedSignatureRef = useRef<string | null>(null);

  const performInitialSync = useCallback(async () => {
    if (Platform.OS !== 'ios' || !enabled) return;

    try {
      const appGroupData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
      if (!appGroupData) return;

      const newSig = await syncAppGroupToAsyncStorage(appGroupData, null);
      lastSyncedSignatureRef.current = newSig;
      if (newSig) {
        await onDataSynced();
      }
    } catch (error) {
      logger.error('Error during initial App Group sync:', error);
    }
  }, [enabled, onDataSynced]);

  return { performInitialSync };
}
