import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { Platform } from 'react-native';
import logger from "../utils/logger";
import WidgetUpdateModule from './WidgetUpdateModule';

// 주말 4개 예배 (목요찬양집회는 설교 제목/본문이 없어 제외, 시각은 sermons-v2.md 기준)
// sermons-v2 문서의 worship_type은 항상 이 4개 값 중 하나다.
export type WorshipType = 'SAT_1700' | 'SUN_0950' | 'SUN_1150' | 'SUN_1430';

// 사용자가 설정 화면에서 고를 수 있는 값. 'ALL'은 클라이언트 로컬 설정에만 존재하며
// Firestore sermons-v2 문서에는 절대 저장되지 않는다([#278]) — 레거시 sermon_events_v2 /
// 'sermons' 컬렉션 단일 최신 문서를 그대로 보여주는 기존 동작을 보존하는 옵션이다.
export type WorshipSetting = WorshipType | 'ALL';

export const WORSHIP_TYPES: { key: WorshipType; label: string }[] = [
  { key: 'SAT_1700', label: '토요일 오후 5시' },
  { key: 'SUN_0950', label: '주일 9시 50분' },
  { key: 'SUN_1150', label: '주일 11시 50분' },
  { key: 'SUN_1430', label: '주일 2시 30분' },
];

// '전체'는 그리드 맨 마지막(2열 wrap에서 홀수 5번째 = 넓은 단독 칸)에 오도록 끝에 둔다([#278] UI 피드백).
export const WORSHIP_SETTINGS: { key: WorshipSetting; label: string }[] = [
  ...WORSHIP_TYPES,
  { key: 'ALL', label: '전체' },
];

export type FirestoreTimestamp = { seconds: number; nanoseconds: number };

export interface Sermon {
  id: string;
  title: string;
  content: string;
  date: string; // 설교 날짜 (YYYY-MM-DD)
  category?: string; // 설교 카테고리
  day_of_week?: string; // 요일 (예: "SUN")
  video_url?: string;
  worship_type?: WorshipType;
  week?: string; // ISO 8601 week_number (예: "2026-W37"), sermons-v2 주간 묶음 키
  /**
   * Firestore `bible_references` 배열의 JSON 문자열([#173]).
   * 화면이 참조별 칩을 그리려면 이 값이 필요한데, 예전에는 변환 과정에서 버려져
   * AsyncStorage를 한 번 왕복하면 사라졌다. 문자열로 두는 이유는 FCM 경로(SermonRaw)와
   * 모양을 맞춰 저장·복원이 그대로 통과하게 하기 위해서다.
   */
  bible_references?: string;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

// FCM에서 받는 원시 데이터 타입 (ISO 문자열 가능)
export interface SermonRaw {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
  day_of_week?: string;
  dayOfWeek?: string;
  bible_references?: string;
  video_url?: string;
  source_id?: string;
  worship_type?: WorshipType;
  week?: string;
  created_at?: FirestoreTimestamp | string;
  createdAt?: FirestoreTimestamp | string;
  updated_at?: FirestoreTimestamp | string;
  updatedAt?: FirestoreTimestamp | string;
}

// 메타데이터 타입 정의
export interface SermonMetadata {
  latestDate: string; // 가장 최근 날짜 (YYYY-MM-DD)
  lastUpdated: string;
}

// 스토리지 키
export const FCM_SERMON_KEY = 'fcm_sermon';
export const USER_WORSHIP_SETTING_KEY = 'user_worship_setting';
export const DEFAULT_WORSHIP_TYPE: WorshipType = 'SUN_0950';


export function convertStringToTimestamp(isoString: string | null | undefined): FirestoreTimestamp {
  if (!isoString || typeof isoString !== 'string') {
    return { seconds: 0, nanoseconds: 0 };
  }

  try {
    const normalized = isoString.replace(/\s+/g, ' ').trim();

    // 먼저 JavaScript Date가 이해할 수 있는 문자열인지 확인
    const directDate = new Date(normalized);
    if (!isNaN(directDate.getTime())) {
      const seconds = Math.floor(directDate.getTime() / 1000);
      const nanoseconds = (directDate.getTime() % 1000) * 1_000_000;
      return { seconds, nanoseconds };
    }

    // 한국어 로케일 형식: 2025년 11월 11일 오전 5시 18분 46초 UTC+9
    const koreanLocaleRegex = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})분\s*(\d{1,2})초\s*UTC([+-]\d{1,2})/;
    const match = normalized.match(koreanLocaleRegex);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Date.UTC는 0부터 시작
      const day = parseInt(match[3], 10);
      const meridiem = match[4];
      let hour = parseInt(match[5], 10);
      const minute = parseInt(match[6], 10);
      const second = parseInt(match[7], 10);
      const offsetHours = parseInt(match[8], 10);

      if (meridiem === '오전') {
        if (hour === 12) {
          hour = 0;
        }
      } else if (meridiem === '오후') {
        if (hour < 12) {
          hour += 12;
        }
      }

      const utcMillis = Date.UTC(year, month, day, hour - offsetHours, minute, second);
      const seconds = Math.floor(utcMillis / 1000);
      const nanoseconds = (utcMillis % 1000) * 1_000_000;
      return { seconds, nanoseconds };
    }
  } catch (e) {
    logger.error('Failed to parse timestamp string:', isoString, e);
  }

  return { seconds: 0, nanoseconds: 0 };
}

function resolveTimestamp(
  snakeCase: FirestoreTimestamp | string | undefined,
  camelCase: FirestoreTimestamp | string | undefined,
): FirestoreTimestamp {
  if (typeof snakeCase === 'string') return convertStringToTimestamp(snakeCase);
  if (typeof camelCase === 'string') return convertStringToTimestamp(camelCase);
  return snakeCase || camelCase || { seconds: 0, nanoseconds: 0 };
}

// FCM 원시 데이터를 Sermon으로 변환하는 함수
export function fcmDataToSermon(raw: SermonRaw): Sermon {
  return {
    id: raw.id || '',
    title: raw.title || '',
    content: raw.content || '',
    date: raw.date || '',
    category: raw.category,
    // sermons-v2 payload엔 day_of_week가 없다. undefined면 JSON.stringify가 키 자체를
    // 날려버려 네이티브 SermonDto(필수 필드)가 MissingFieldException을 던진다([#280] 실기기 확인).
    // firestoreDocToSermon과 동일하게 빈 문자열로 기본값을 채운다.
    day_of_week: raw.day_of_week || raw.dayOfWeek || '',
    video_url: raw.video_url,
    worship_type: raw.worship_type,
    week: raw.week,
    bible_references: raw.bible_references,
    created_at: resolveTimestamp(raw.created_at, raw.createdAt),
    updated_at: resolveTimestamp(raw.updated_at, raw.updatedAt),
  };
}

export const firestoreDocToSermon = async (
  doc: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): Promise<Sermon> => {
  const firestoreData = doc.data();

  let content = firestoreData.content || '';
  const bibleRefs = firestoreData.bible_references;
  if (bibleRefs) {
    // Android: BibleReferenceResolver(Kotlin) 호출
    // iOS: WidgetUpdateModule.resolveBibleReferences(Swift/BibleDbHelper) 호출
    // 두 플랫폼 모두 동일한 JS 경로 사용
    try {
      const resolved = await WidgetUpdateModule.resolveBibleReferences(
        JSON.stringify(bibleRefs),
      );
      content = resolved;
    } catch (e) {
      // bible_references가 빈 배열("말씀 없는 날")인 경우가 흔해 오류가 아니라 정상 상태다.
      // content가 비는 정도로 우아하게 넘어가므로 error(빨간 화면/Crashlytics 비정상 기록)가 아닌
      // warn(Crashlytics 로그만 남김)으로 낮춘다.
      logger.warn('firestoreDocToSermon: bridge resolveBibleReferences failed', e);
      content = '';
    }
  }

  return {
    id: doc.id,
    title: firestoreData.title || '',
    content,
    date: firestoreData.date || new Date().toISOString().split('T')[0],
    category: firestoreData.category || '',
    day_of_week: firestoreData.day_of_week || '',
    video_url: firestoreData.video_url,
    worship_type: firestoreData.worship_type,
    week: firestoreData.week,
    // 화면이 참조별 칩을 그리려면 원본 참조가 필요하다([#173]).
    // FCM 경로(SermonRaw)와 모양을 맞춰 문자열로 보존한다.
    bible_references: bibleRefs ? JSON.stringify(bibleRefs) : undefined,
    created_at: firestoreData.created_at || { seconds: 0, nanoseconds: 0 },
    updated_at: firestoreData.updated_at || { seconds: 0, nanoseconds: 0 },
  };
};

function convertToComparableTimestamp(timestamp: FirestoreTimestamp | string | null | undefined): number {
  if (!timestamp) return 0;
  
  // 문자열이면 ISO 문자열로 간주
  if (typeof timestamp === 'string') {
    const parsed = convertStringToTimestamp(timestamp);
    return parsed.seconds * 1000 + Math.floor(parsed.nanoseconds / 1_000_000);
  }
  
  // Firestore 타임스탬프
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1000000);
  }
  
  return 0;
}

// Sermon을 date, updatedAt 순서로 비교하는 함수
export function compareSermon(a: Sermon | null, b: Sermon | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  // date가 더 큰 쪽이 최신
  if (a.date > b.date) return 1;
  if (a.date < b.date) return -1;

  // date가 같으면 updatedAt 비교
  const aTime = convertToComparableTimestamp(a.updated_at);
  const bTime = convertToComparableTimestamp(b.updated_at);

  return aTime > bTime ? 1 : aTime < bTime ? -1 : 0;
}