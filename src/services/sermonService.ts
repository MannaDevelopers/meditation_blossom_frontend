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
  LEGACY_SERMON_CACHE_KEY,
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

// '전체' 옵션 전용 — legacy 'sermons' 컬렉션의 최신 문서만 담아둔다. FCM_SERMON_KEY는
// 예배시간 설정에 따라 sermons-v2 문서로도 덮어써지는 "지금 화면에 표시 중인 설교" 슬롯이라,
// 그걸 legacy 문서로 착각하면 안 되는 곳(SettingsScreen의 '전체' 전환/새로고침 재조정)에서
// 이 전용 키를 쓴다.
export async function fetchLegacySermonFromCache(): Promise<Sermon | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_SERMON_CACHE_KEY);
    if (raw) {
      return fcmDataToSermon(JSON.parse(raw) as SermonRaw);
    }
  } catch (error) {
    logger.warn('Failed to load legacy sermon cache, clearing corrupted data');
    await AsyncStorage.removeItem(LEGACY_SERMON_CACHE_KEY).catch(() => {});
  }
  return null;
}

export async function saveLegacySermonToCache(sermon: Sermon): Promise<void> {
  await AsyncStorage.setItem(LEGACY_SERMON_CACHE_KEY, JSON.stringify(sermon));
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
// iOS 전용 App Group 키 — Swift `WorshipSermonSync.weeklySermonsPendingKey`와 동일한 문자열이어야 한다.
export const WEEKLY_SERMONS_PENDING_KEY = 'weekly_sermons_pending';

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

// iOS 전용: NotificationService(Extension)가 앱 종료 상태에서 App Group에 쌓아둔 sermons-v2
// 항목을 앱 실행 시 weekly_sermons 캐시로 병합한다([#306], useAppGroupSync). 네이티브가 이미
// upsertWeeklySermonFromEvent와 동일한 규칙(같은 week의 다른 worship_type은 보존, 같은
// worship_type은 교체, 다른 week는 버림)으로 대기열을 정리해뒀으므로, 여기서는 그 결과를
// 기존 캐시에 순서대로 반복 적용하기만 하면 된다.
export function mergeWeeklySermonIntoCache(existing: Sermon[], incoming: Sermon): Sermon[] {
  const sameWeekOthers = existing.filter(
    s => s.week === incoming.week && s.worship_type !== incoming.worship_type,
  );
  return [...sameWeekOthers, incoming];
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

// 레거시 'sermons' 컬렉션용 FCM(sermon_events/sermon_events_v2) payload를 Firestore 재조회 없이
// 바로 Sermon으로 변환한다. week/worship_type이 없는 이벤트는 여기로 온다(upsertWeeklySermonFromEvent와
// 반대 경우) — '전체' 옵션은 예배별로 나뉠 필요가 없어 캐시에 patch할 목록도 없으므로 병합 없이
// 그대로 반환한다.
export async function sermonFromLegacyEvent(raw: SermonRaw): Promise<Sermon> {
  const sermon = fcmDataToSermon(raw);
  // 레거시 payload엔 id가 없고 source_id만 있다(docs/fcm-events/sermon-events.md).
  if (!sermon.id) {
    sermon.id = raw.source_id || '';
  }
  // v1(sermon_events)은 content를 평문으로 그대로 보내 여기 올 때 이미 채워져 있다.
  // v2(sermon_events_v2)는 4KB FCM data payload 제한 때문에 content 대신 bible_references만
  // 보내므로, upsertWeeklySermonFromEvent/firestoreDocToSermon과 동일하게 로컬 성경 DB에서
  // 본문을 조립한다. bible_references에 verses[].content가 실려 오긴 하지만 긴 설교는 4KB
  // 제한에 걸려 잘려 빠질 수 있어 신뢰할 수 없다 — 그대로 쓰지 않고 book/chapter/verse
  // 범위만 참고해 항상 새로 조회한다.
  if (!sermon.content && raw.bible_references) {
    try {
      sermon.content = await WidgetUpdateModule.resolveBibleReferences(raw.bible_references);
    } catch (e) {
      // firestoreDocToSermon과 동일한 이유로 warn — 빈 bible_references는 정상적인 "말씀 없는 날" 상태다.
      logger.warn('sermonFromLegacyEvent: bridge resolveBibleReferences failed', e);
    }
  }
  return sermon;
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
