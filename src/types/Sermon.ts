import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import logger from "../utils/logger";

export type FirestoreTimestamp = { seconds: number; nanoseconds: number };

export interface Sermon {
  id: string;
  title: string;
  content: string;
  date: string; // 설교 날짜 (YYYY-MM-DD)
  category?: string; // 설교 카테고리
  day_of_week?: string; // 요일 (예: "SUN")
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
    day_of_week: raw.day_of_week || raw.dayOfWeek,
    created_at: resolveTimestamp(raw.created_at, raw.createdAt),
    updated_at: resolveTimestamp(raw.updated_at, raw.updatedAt),
  };
}

export const firestoreDocToSermon = (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot): Sermon => {
  const firestoreData = doc.data();

  return {
    id: doc.id,
    title: firestoreData.title || '',
    content: firestoreData.content || '',
    date: firestoreData.date || new Date().toISOString().split('T')[0],
    category: firestoreData.category || '',
    day_of_week: firestoreData.day_of_week || '',
    created_at: firestoreData.created_at || { seconds: 0, nanoseconds: 0 },
    updated_at: firestoreData.updated_at || { seconds: 0, nanoseconds: 0 }
  };
}

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