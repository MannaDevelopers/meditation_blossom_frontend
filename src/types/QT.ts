import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { convertStringToTimestamp, FirestoreTimestamp } from './Sermon';
import WidgetUpdateModule from './WidgetUpdateModule';
import logger from '../utils/logger';

export const FCM_QT_KEY = 'fcm_qt';

export interface QT {
  id: string;
  title: string;
  series_title: string;
  content: string;
  date: string;
  day_of_week?: string;
  video_url?: string;
  meditation_questions?: string;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

export interface QTRaw {
  id: string;
  title: string;
  series_title: string;
  content: string;
  date: string;
  day_of_week?: string;
  dayOfWeek?: string;
  bible_references?: string;
  meditation_questions?: string;
  video_url?: string;
  source_id?: string;
  created_at?: FirestoreTimestamp | string;
  createdAt?: FirestoreTimestamp | string;
  updated_at?: FirestoreTimestamp | string;
  updatedAt?: FirestoreTimestamp | string;
}

function resolveTimestamp(
  snakeCase: FirestoreTimestamp | string | undefined,
  camelCase: FirestoreTimestamp | string | undefined,
): FirestoreTimestamp {
  if (typeof snakeCase === 'string') return convertStringToTimestamp(snakeCase);
  if (typeof camelCase === 'string') return convertStringToTimestamp(camelCase);
  return snakeCase || camelCase || { seconds: 0, nanoseconds: 0 };
}

export function fcmDataToQt(raw: QTRaw): QT {
  return {
    id: raw.id || '',
    title: raw.title || '',
    series_title: raw.series_title || '',
    content: raw.content || '',
    date: raw.date || '',
    day_of_week: raw.day_of_week || raw.dayOfWeek,
    video_url: raw.video_url,
    meditation_questions: raw.meditation_questions,
    created_at: resolveTimestamp(raw.created_at, raw.createdAt),
    updated_at: resolveTimestamp(raw.updated_at, raw.updatedAt),
  };
}

export const firestoreDocToQt = async (
  doc: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): Promise<QT> => {
  const data = doc.data();
  let content = data.content || '';
  const bibleRefs = data.bible_references;
  if (bibleRefs) {
    // Android: BibleReferenceResolver(Kotlin) 호출
    // iOS: WidgetUpdateModule.resolveBibleReferences(Swift/BibleDbHelper) 호출
    // 두 플랫폼 모두 동일한 JS 경로 사용
    try {
      content = await WidgetUpdateModule.resolveBibleReferences(JSON.stringify(bibleRefs));
    } catch (e) {
      logger.error('firestoreDocToQt: bridge resolveBibleReferences failed', e);
      content = '';
    }
  }
  return {
    id: doc.id,
    title: data.title || '',
    series_title: data.series_title || '',
    content,
    date: data.date || new Date().toISOString().split('T')[0],
    day_of_week: data.day_of_week || '',
    video_url: data.video_url,
    meditation_questions: data.meditation_questions
      ? JSON.stringify(data.meditation_questions)
      : undefined,
    created_at: data.created_at || { seconds: 0, nanoseconds: 0 },
    updated_at: data.updated_at || { seconds: 0, nanoseconds: 0 },
  };
};

function toMillis(t: FirestoreTimestamp | string | null | undefined): number {
  if (!t) return 0;
  if (typeof t === 'string') {
    const parsed = convertStringToTimestamp(t);
    return parsed.seconds * 1000 + Math.floor(parsed.nanoseconds / 1_000_000);
  }
  if (typeof t === 'object' && 'seconds' in t) {
    return t.seconds * 1000 + Math.floor(t.nanoseconds / 1_000_000);
  }
  return 0;
}

export function compareQt(a: QT | null, b: QT | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (a.date > b.date) return 1;
  if (a.date < b.date) return -1;
  const aTime = toMillis(a.updated_at);
  const bTime = toMillis(b.updated_at);
  return aTime > bTime ? 1 : aTime < bTime ? -1 : 0;
}
