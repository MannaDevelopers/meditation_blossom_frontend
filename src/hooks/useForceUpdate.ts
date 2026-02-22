import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, Platform } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';
import {
  checkForceUpdate,
  ForceUpdateCheckResult,
} from '../services/forceUpdateService';
import { ForceUpdateConfig } from '../types/ForceUpdate';
import logger from '../utils/logger';

interface UseForceUpdateResult {
  isChecking: boolean;
  needsUpdate: boolean;
  config: ForceUpdateConfig | null;
  showFallbackModal: boolean;
  startUpdate: () => void;
}

const inAppUpdates = new SpInAppUpdates(false);

export function useForceUpdate(): UseForceUpdateResult {
  const [isChecking, setIsChecking] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [config, setConfig] = useState<ForceUpdateConfig | null>(null);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const checkedRef = useRef(false);

  const performCheck = useCallback(async () => {
    try {
      const result: ForceUpdateCheckResult = await checkForceUpdate();
      setNeedsUpdate(result.needsUpdate);
      setConfig(result.config);

      if (result.needsUpdate) {
        triggerUpdate(result.config);
      }
    } catch (error) {
      logger.error('Force update check failed', error);
      setNeedsUpdate(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const triggerUpdate = useCallback((cfg: ForceUpdateConfig) => {
    if (Platform.OS === 'android') {
      inAppUpdates
        .startUpdate({ updateType: IAUUpdateKind.IMMEDIATE })
        .catch((error: unknown) => {
          logger.warn('Android in-app update failed, showing fallback modal', error);
          setShowFallbackModal(true);
        });
    } else {
      inAppUpdates
        .startUpdate({
          forceUpgrade: true,
          title: '업데이트 필요',
          message: cfg.force_update_message,
          buttonUpgradeText: '업데이트',
          country: 'kr',
        })
        .catch((error: unknown) => {
          logger.warn('iOS in-app update failed, showing fallback modal', error);
          setShowFallbackModal(true);
        });
    }
  }, []);

  const startUpdate = useCallback(() => {
    if (!config) return;
    const storeUrl =
      Platform.OS === 'ios' ? config.ios_store_url : config.android_store_url;
    Linking.openURL(storeUrl).catch((error: unknown) => {
      logger.error('Failed to open store URL', error);
    });
  }, [config]);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      performCheck();
    }
  }, [performCheck]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && needsUpdate) {
        performCheck();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [needsUpdate, performCheck]);

  return { isChecking, needsUpdate, config, showFallbackModal, startUpdate };
}
