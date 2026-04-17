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
  FCM_QT_KEY,
  fcmDataToQt,
  firestoreDocToQt,
  QT,
  QTRaw,
} from '../types/QT';
import logger from '../utils/logger';

export async function fetchLatestQtFromCache(): Promise<QT | null> {
  try {
    const db = getFirestore();
    const q = query(collection(db, 'qt'), orderBy('date', 'desc'), limit(1));
    const snapshot = await getDocsFromCache(q);
    return snapshot.empty ? null : await firestoreDocToQt(snapshot.docs[0]);
  } catch (error) {
    logger.error('Failed to load QT from Firestore cache', error);
    return null;
  }
}

export async function fetchLatestQtFromAsyncStorage(): Promise<QT | null> {
  try {
    const raw = await AsyncStorage.getItem(FCM_QT_KEY);
    if (raw) {
      return fcmDataToQt(JSON.parse(raw) as QTRaw);
    }
  } catch (error) {
    logger.error('Failed to load QT from AsyncStorage', error);
  }
  return null;
}

export async function fetchLatestQtFromServer(): Promise<QT | null> {
  const db = getFirestore();
  const q = query(collection(db, 'qt'), orderBy('date', 'desc'), limit(1));
  const snapshot = await getDocsFromServer(q);
  if (snapshot.empty) {
    logger.log('No QT found on server');
    return null;
  }
  return await firestoreDocToQt(snapshot.docs[0]);
}

export function isQtDataStale(
  qtDate: Date | null,
  thresholdDays: number = STALE_DATA_THRESHOLD_DAYS,
): boolean {
  if (qtDate == null) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);
  return qtDate <= cutoff;
}
