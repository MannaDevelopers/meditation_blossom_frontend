import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from '@react-native-firebase/remote-config';
import { Platform } from 'react-native';
import { getVersion } from 'react-native-device-info';
import { ForceUpdateConfig, needsForceUpdate } from '../types/ForceUpdate';
import logger from '../utils/logger';

const DEFAULTS: Record<string, string | boolean> = {
  force_update_enabled: false,
  android_min_version: '1.0.0',
  ios_min_version: '1.0.0',
  force_update_message: '새로운 버전이 출시되었습니다.\n업데이트 후 이용해주세요.',
  android_store_url:
    'https://play.google.com/store/apps/details?id=app.mannadev.meditation',
  ios_store_url:
    'https://apps.apple.com/kr/app/%EB%AC%B5%EC%83%81%EB%A7%8C%EA%B0%9C/id6754749244',
};

export async function initRemoteConfig(): Promise<void> {
  try {
    const rc = getRemoteConfig();
    // v25+ 모듈형 API: settings/defaultConfig setter가 네이티브 반영을 큐에 넣고,
    // fetchAndActivate()는 그 큐가 끝난 뒤 실행된다.
    rc.settings = { ...rc.settings, minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000 };
    rc.defaultConfig = DEFAULTS;
    await fetchAndActivate(rc);
  } catch (error) {
    logger.error('Failed to fetch Remote Config', error);
  }
}

export function getForceUpdateConfig(): ForceUpdateConfig {
  const rc = getRemoteConfig();
  return {
    force_update_enabled: getValue(rc, 'force_update_enabled').asBoolean(),
    android_min_version: getValue(rc, 'android_min_version').asString(),
    ios_min_version: getValue(rc, 'ios_min_version').asString(),
    force_update_message: getValue(rc, 'force_update_message').asString(),
    android_store_url: getValue(rc, 'android_store_url').asString(),
    ios_store_url: getValue(rc, 'ios_store_url').asString(),
  };
}

export interface ForceUpdateCheckResult {
  needsUpdate: boolean;
  config: ForceUpdateConfig;
  currentVersion: string;
}

export async function checkForceUpdate(): Promise<ForceUpdateCheckResult> {
  await initRemoteConfig();
  const config = getForceUpdateConfig();
  const currentVersion = getVersion();
  const minimumVersion =
    Platform.OS === 'ios' ? config.ios_min_version : config.android_min_version;
  return {
    needsUpdate: needsForceUpdate(
      currentVersion,
      minimumVersion,
      config.force_update_enabled,
    ),
    config,
    currentVersion,
  };
}
