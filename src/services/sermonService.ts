import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { STALE_DATA_THRESHOLD_DAYS } from '../constants';
import {
  FCM_SERMON_KEY,
  fcmDataToSermon,
  firestoreDocToSermon,
  Sermon,
  SermonRaw,
} from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';
import { normalizeJsonString } from '../utils/normalize';

export async function fetchLatestSermonFromAsyncStorage(): Promise<Sermon | null> {
  try {
    const raw = await AsyncStorage.getItem(FCM_SERMON_KEY);
    if (raw) {
      return fcmDataToSermon(JSON.parse(raw) as SermonRaw);
    }
  } catch (error) {
    logger.warn('Failed to load sermon from AsyncStorage, clearing corrupted data');
    // 오염된 데이터가 반복적으로 파싱 오류를 일으키지 않도록 삭제
    await AsyncStorage.removeItem(FCM_SERMON_KEY).catch(() => {});
  }
  return null;
}

export function subscribeToLatestSermon(
  onUpdate: (sermon: Sermon) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirestore();
  const q = query(
    collection(db, 'sermons'),
    orderBy('date', 'desc'),
    limit(1),
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty || snapshot.metadata.fromCache) return;
      try {
        const sermon = await firestoreDocToSermon(snapshot.docs[0]);
        onUpdate(sermon);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    onError,
  );
}

export async function saveSermonToAsyncStorage(sermon: Sermon): Promise<void> {
  await AsyncStorage.setItem(FCM_SERMON_KEY, JSON.stringify(sermon));
}

export async function pushSermonToWidget(sermon: Sermon): Promise<void> {
  if (!WidgetUpdateModule?.onSermonUpdated) {
    logger.error('WidgetUpdateModule.onSermonUpdated is not available');
    return;
  }
  await WidgetUpdateModule.onSermonUpdated(JSON.stringify(sermon));
}

export async function fetchLatestSermonFromServer(): Promise<Sermon | null> {
  const db = getFirestore();
  const q = query(
    collection(db, 'sermons'),
    orderBy('date', 'desc'),
    limit(1),
  );
  const snapshot = await getDocsFromServer(q);
  if (snapshot.empty) {
    logger.log('No sermons found on server');
    return null;
  }
  return await firestoreDocToSermon(snapshot.docs[0]);
}

export async function readAppGroupData(key: string): Promise<string | null> {
  if (!WidgetUpdateModule?.getAppGroupData) {
    if (Platform.OS === 'ios') {
      logger.warn('WidgetUpdateModule.getAppGroupData is not available on iOS');
    }
    return null;
  }
  return WidgetUpdateModule.getAppGroupData(key);
}

export async function syncAppGroupToAsyncStorage(
  data: string,
  lastSignature: string | null,
): Promise<string | null> {
  const normalized = normalizeJsonString(data);
  if (normalized === null) {
    logger.warn('Skipping App Group sync: failed to normalize data');
    return null;
  }
  if (normalized === lastSignature) {
    return null; // no change
  }
  await AsyncStorage.setItem(FCM_SERMON_KEY, data);
  logger.log('Synced App Group data to AsyncStorage');
  return normalized;
}

export function isSermonDataStale(
  sermonDate: Date | null,
  thresholdDays: number = STALE_DATA_THRESHOLD_DAYS,
): boolean {
  if (sermonDate == null) return true;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);
  return sermonDate <= cutoff;
}
