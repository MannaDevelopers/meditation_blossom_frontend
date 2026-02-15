import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import logger from "../utils/logger";

// 타입 정의
export interface Sermon {
  id: string;
  title: string;
  content: string;
  date: string; // 설교 날짜 (YYYY-MM-DD)
  category?: string; // 설교 카테고리
  day_of_week?: string; // 요일 (예: "SUN")
  created_at: { seconds: number, nanoseconds: number }; // Firestore 타임스탬프 (초 단위)
  updated_at: { seconds: number, nanoseconds: number }; // Firestore 타임스탬프 (초 단위)
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
  created_at?: { seconds: number, nanoseconds: number } | string; // Firestore 타임스탬프 또는 ISO 문자열
  createdAt?: { seconds: number, nanoseconds: number } | string;
  updated_at?: { seconds: number, nanoseconds: number } | string; // Firestore 타임스탬프 또는 ISO 문자열
  updatedAt?: { seconds: number, nanoseconds: number } | string;
}

// 메타데이터 타입 정의
export interface SermonMetadata {
  latestDate: string; // 가장 최근 날짜 (YYYY-MM-DD)
  lastUpdated: string;
}

// 스토리지 키
export const FCM_SERMON_KEY = 'fcm_sermon';


// 문자열을 Firestore 타임스탬프로 변환하는 함수
function convertStringToTimestamp(isoString: string | null | undefined): { seconds: number, nanoseconds: number } {
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

// FCM 원시 데이터를 Sermon으로 변환하는 함수
export function fcmDataToSermon(raw: SermonRaw): Sermon {
  return {
    id: raw.id || '',
    title: raw.title || '',
    content: raw.content || '',
    date: raw.date || '',
    category: raw.category,
    day_of_week: raw.day_of_week || raw.dayOfWeek,
    created_at: typeof raw.created_at === 'string'
      ? convertStringToTimestamp(raw.created_at)
      : typeof raw.createdAt === 'string'
        ? convertStringToTimestamp(raw.createdAt)
        : (raw.created_at || raw.createdAt || { seconds: 0, nanoseconds: 0 }),
    updated_at: typeof raw.updated_at === 'string'
      ? convertStringToTimestamp(raw.updated_at)
      : typeof raw.updatedAt === 'string'
        ? convertStringToTimestamp(raw.updatedAt)
        : (raw.updated_at || raw.updatedAt || { seconds: 0, nanoseconds: 0 })
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

// Firestore 타임스탬프를 숫자로 비교하기 쉽게 변환
function convertToComparableTimestamp(timestamp: { seconds: number, nanoseconds: number } | string | null | undefined): number {
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

  logger.log(`  🔍 Comparing:`);
  logger.log(`    A: ${a.title?.substring(0, 20)}... date=${a.date}, updated_at=${JSON.stringify(a.updated_at)}`);
  logger.log(`    B: ${b.title?.substring(0, 20)}... date=${b.date}, updated_at=${JSON.stringify(b.updated_at)}`);

  // date가 더 큰 쪽이 최신
  if (a.date > b.date) {
    logger.log(`    → A is newer (date: ${a.date} > ${b.date})`);
    return 1;
  }
  if (a.date < b.date) {
    logger.log(`    → B is newer (date: ${a.date} < ${b.date})`);
    return -1;
  }

  logger.log(`    → Dates are equal, comparing updated_at...`);
  
  // date가 같으면 updatedAt 비교
  const aTime = convertToComparableTimestamp(a.updated_at);
  const bTime = convertToComparableTimestamp(b.updated_at);
  
  if (aTime > bTime) {
    logger.log(`    → A is newer (updated_at)`);
    return 1;
  }
  if (aTime < bTime) {
    logger.log(`    → B is newer (updated_at)`);
    return -1;
  }

  logger.log(`    → Both are equal`);
  // 완전히 같으면 0
  return 0;
}