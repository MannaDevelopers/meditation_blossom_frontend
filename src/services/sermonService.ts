import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocsFromCache,
  getDocsFromServer,
  getFirestore,
  limit,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
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

export async function fetchLatestSermonFromCache(): Promise<Sermon | null> {
  try {
    const db = getFirestore();
    const q = query(
      collection(db, 'sermons'),
      orderBy('date', 'desc'),
      limit(1),
    );
    const snapshot = await getDocsFromCache(q);
    return snapshot.empty ? null : firestoreDocToSermon(snapshot.docs[0]);
  } catch (error) {
    logger.error('Failed to load sermon from Firestore cache', error);
    return null;
  }
}

export async function fetchLatestSermonFromAsyncStorage(): Promise<Sermon | null> {
  try {
    const raw = await AsyncStorage.getItem(FCM_SERMON_KEY);
    if (raw) {
      return fcmDataToSermon(JSON.parse(raw) as SermonRaw);
    }
  } catch (error) {
    logger.error('Failed to load sermon from AsyncStorage', error);
  }
  return null;
}

export async function fetchLatestSermonFromServer(): Promise<Sermon | null> {
  try {
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
    return firestoreDocToSermon(snapshot.docs[0]);
  } catch (error) {
    logger.error('Error fetching sermon from server:', error);
    return null;
  }
}

export async function readAppGroupData(key: string): Promise<string | null> {
  if (!WidgetUpdateModule?.getAppGroupData) {
    return null;
  }
  return WidgetUpdateModule.getAppGroupData(key);
}

export async function syncAppGroupToAsyncStorage(
  data: string,
  lastSignature: string | null,
): Promise<string | null> {
  const normalized = normalizeJsonString(data);
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
