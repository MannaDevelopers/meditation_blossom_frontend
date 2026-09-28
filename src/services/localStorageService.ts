import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

export const LOCAL_STORAGE_KEYS = {
  DEFAULT_MAIN_TAB: 'default_main_tab',
} as const;
type LocalStorageKeys = typeof LOCAL_STORAGE_KEYS;
type LocalStorageKey = LocalStorageKeys[keyof LocalStorageKeys];

export interface StorageData extends Record<LocalStorageKey, unknown> {
  DEFAULT_MAIN_TAB: {
    name: '주일 말씀' | '매일 만나';
  };
}

type Value = object;

export class LocalStorageService {
  static async set<T extends Value>(key: LocalStorageKey, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  static async get<T extends Value>(key: LocalStorageKey): Promise<T | null> {
    const data = await AsyncStorage.getItem(key);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch (e) {
      logger.warn(`LocalStorageService.get(${key}): JSON 파싱 실패`, e);
      return null;
    }
  }

  // get → set 사이가 비동기라 같은 키를 동시에 update하면 나중 쓰기가 앞선 병합을 덮어쓴다.
  static async update<T extends Value>(
    key: LocalStorageKey,
    value: Partial<T> | ((prevValue: T | null) => Partial<T>),
    options?: {
      mergeOnlyIfExists?: boolean;
    },
  ) {
    const storedData = await LocalStorageService.get<T>(key);
    const mergeOnlyIfExists = options?.mergeOnlyIfExists ?? true;

    const data = storedData ?? ((mergeOnlyIfExists ? null : {}) as T | null);

    if (!data) {
      return;
    }

    const _value = typeof value === 'function' ? value(data) : value;
    const newData = {...data, ..._value};

    await LocalStorageService.set<T>(key, newData);
  }

  static async delete(key: LocalStorageKey) {
    await AsyncStorage.removeItem(key);
  }

  // AsyncStorage.clear()는 fcm_sermon, 묵상 메모 등 앱 전체 키를 지우므로 이 서비스가 관리하는 키만 지운다.
  static async clear() {
    await AsyncStorage.multiRemove(Object.values(LOCAL_STORAGE_KEYS));
  }
}
