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
import { STALE_DATA_THRESHOLD_DAYS } from '../constants';
import {
  FCM_QT_KEY,
  fcmDataToQt,
  firestoreDocToQt,
  QT,
  QTRaw,
} from '../types/QT';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';


export async function fetchLatestQtFromAsyncStorage(): Promise<QT | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(FCM_QT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QTRaw;
      const qt = fcmDataToQt(parsed);

      // content가 비어 있고 bible_references가 있으면 네이티브 DB 조회
      // (FCM v2 포맷: content 없이 bible_references만 전달, native가 못 처리한 경우)
      if (!qt.content && parsed.bible_references) {
        try {
          const refsJson = typeof parsed.bible_references === 'string'
            ? parsed.bible_references
            : JSON.stringify(parsed.bible_references);
          const resolved = await WidgetUpdateModule.resolveBibleReferences(refsJson);
          return { ...qt, content: resolved };
        } catch (e) {
          logger.error('fetchLatestQtFromAsyncStorage: resolveBibleReferences failed', e);
        }
      }

      return qt;
    }
  } catch (error) {
    logger.warn('Failed to load QT from AsyncStorage, clearing corrupted data');
    // 오염된 데이터가 반복적으로 파싱 오류를 일으키지 않도록 삭제
    await AsyncStorage.removeItem(FCM_QT_KEY).catch(() => {});
  }
  return null;
}

export async function saveQtToAsyncStorage(qt: QT): Promise<void> {
  await AsyncStorage.setItem(FCM_QT_KEY, JSON.stringify(qt));
}

export function subscribeToLatestQt(
  onUpdate: (qt: QT) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirestore();
  const q = query(
    collection(db, 'qt'),
    orderBy('date', 'desc'),
    limit(1),
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty || snapshot.metadata.fromCache) return;
      try {
        const qt = await firestoreDocToQt(snapshot.docs[0]);
        onUpdate(qt);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    onError,
  );
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
