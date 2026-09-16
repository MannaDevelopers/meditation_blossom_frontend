import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { STALE_DATA_THRESHOLD_DAYS } from '../constants';
import {
  FCM_SERMON_KEY,
  fcmDataToSermon,
  firestoreDocToSermon,
  Sermon,
  SermonRaw,
  WorshipType,
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

export const WEEKLY_SERMONS_KEY = 'weekly_sermons';

export async function fetchLatestWeeklySermonsFromAsyncStorage(): Promise<Sermon[]> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_SERMONS_KEY);
    if (raw) {
      return JSON.parse(raw) as Sermon[];
    }
  } catch (error) {
    logger.warn('Failed to load weekly sermons from AsyncStorage, clearing corrupted data');
    await AsyncStorage.removeItem(WEEKLY_SERMONS_KEY).catch(() => {});
  }
  return [];
}

export async function saveWeeklySermonsToAsyncStorage(sermons: Sermon[]): Promise<void> {
  await AsyncStorage.setItem(WEEKLY_SERMONS_KEY, JSON.stringify(sermons));
}

// sermons-v2 UPDATED/CREATED FCM payload 하나로 weekly_sermons 캐시의 해당 문서 하나만
// 갱신한다([#280]). week/worship_type이 없으면(레거시 이벤트 등) 패치할 수 없으므로 null 반환 —
// 호출자는 이 경우 fetchLatestWeeklySermonsFromServer()로 폴백해야 한다.
// 캐시가 다른(이전) 주간 데이터만 갖고 있으면, 그 주 데이터는 버리고 이 문서 하나로 새 주를 시작한다
// (주가 바뀌는 시점에 오래된 예배 데이터가 새 주 데이터와 섞이는 것을 방지).
export async function upsertWeeklySermonFromEvent(raw: SermonRaw): Promise<Sermon | null> {
  if (!raw.week || !raw.worship_type) return null;

  const incoming = fcmDataToSermon(raw);
  // fcmDataToSermon은 동기 함수라 content를 그대로 옮길 뿐 bible_references를 해석하지 않는다.
  // firestoreDocToSermon과 동일하게 여기서 직접 해석해야 본문이 비어 보이지 않는다.
  if (!incoming.content && raw.bible_references) {
    try {
      incoming.content = await WidgetUpdateModule.resolveBibleReferences(raw.bible_references);
    } catch (e) {
      // firestoreDocToSermon과 동일한 이유로 warn — 빈 bible_references는 정상적인 "말씀 없는 날" 상태다.
      logger.warn('upsertWeeklySermonFromEvent: bridge resolveBibleReferences failed', e);
    }
  }
  // sermons-v2-events.md 페이로드엔 id가 없다 — Firestore 문서 ID 규칙과 동일하게 구성한다.
  if (!incoming.id) {
    incoming.id = `${raw.week}_${raw.worship_type}`;
  }

  const weekly = await fetchLatestWeeklySermonsFromAsyncStorage();
  const sameWeekOthers = weekly.filter(
    s => s.week === incoming.week && s.worship_type !== incoming.worship_type,
  );
  const next = [...sameWeekOthers, incoming];
  await saveWeeklySermonsToAsyncStorage(next);
  return incoming;
}

// 예배 시간 설정을 막 바꾼 사용자(특히 앱을 처음 이 버전으로 업데이트해서
// weekly_sermons 캐시가 아직 한 번도 채워진 적 없는 경우)를 위해, 로컬 캐시가
// 비어 있으면 서버에서 직접 가져온다. 이게 없으면 "설정만 바꾸고 데이터 새로고침을
// 따로 눌러야 반영되는" 문제가 생긴다(실사용자 리포트로 발견).
export async function syncSelectedSermonToWidget(worshipType: WorshipType): Promise<void> {
  let weekly = await fetchLatestWeeklySermonsFromAsyncStorage();
  if (weekly.length === 0) {
    try {
      weekly = await fetchLatestWeeklySermonsFromServer();
      if (weekly.length > 0) {
        await saveWeeklySermonsToAsyncStorage(weekly);
      }
    } catch (e) {
      logger.warn('syncSelectedSermonToWidget: 로컬 캐시가 비어 서버 폴백 조회 시도했으나 실패 (오프라인?)', e);
    }
  }
  if (weekly.length === 0) return;

  const matched = weekly.find(s => s.worship_type === worshipType) || weekly[0];
  await saveSermonToAsyncStorage(matched);
  await pushSermonToWidget(matched);
}

// sermons-v2: 주말 4개 예배 문서가 공통 'week'(ISO 8601 week_number, 예: "2026-W37")를 공유한다.
// 토요/주일 예배는 실제 date가 다르므로 date가 아닌 week로 같은 주 문서를 묶는다.
export async function fetchLatestWeeklySermonsFromServer(): Promise<Sermon[]> {
  const db = getFirestore();
  const q = query(
    collection(db, 'sermons-v2'),
    orderBy('week', 'desc'),
    limit(8)
  );
  const snapshot = await getDocsFromServer(q);
  if (snapshot.empty) return [];

  const allSermons: Sermon[] = [];
  for (const doc of snapshot.docs) {
    try {
      const s = await firestoreDocToSermon(doc);
      allSermons.push(s);
    } catch (e) {
      logger.error('Failed to parse weekly sermon doc', e);
    }
  }

  if (allSermons.length === 0) return [];
  const latestWeek = allSermons[0].week;
  return allSermons.filter(s => s.week === latestWeek);
}
