import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

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
  created_at?: { seconds: number, nanoseconds: number } | string; // Firestore 타임스탬프 또는 ISO 문자열
  updated_at?: { seconds: number, nanoseconds: number } | string; // Firestore 타임스탬프 또는 ISO 문자열
}

// 메타데이터 타입 정의
export interface SermonMetadata {
  latestDate: string; // 가장 최근 날짜 (YYYY-MM-DD)
  lastUpdated: string;
}

// 스토리지 키
export const FCM_SERMON_KEY = 'fcm_sermon';


// ISO 문자열을 Firestore 타임스탬프로 변환하는 함수
function convertIsoToTimestamp(isoString: string | null | undefined): { seconds: number, nanoseconds: number } {
  if (!isoString || typeof isoString !== 'string') {
    return { seconds: 0, nanoseconds: 0 };
  }
  
  try {
    const date = new Date(isoString);
    const seconds = Math.floor(date.getTime() / 1000);
    const nanoseconds = (date.getTime() % 1000) * 1000000;
    return { seconds, nanoseconds };
  } catch (e) {
    console.error('Failed to parse ISO string:', isoString, e);
    return { seconds: 0, nanoseconds: 0 };
  }
}

// FCM 원시 데이터를 Sermon으로 변환하는 함수
export function fcmDataToSermon(raw: any): Sermon {
  return {
    id: raw.id || '',
    title: raw.title || '',
    content: raw.content || '',
    date: raw.date || '',
    category: raw.category,
    day_of_week: raw.day_of_week || raw.dayOfWeek,
    created_at: typeof raw.created_at === 'string' 
      ? convertIsoToTimestamp(raw.created_at) 
      : (raw.created_at || raw.createdAt || { seconds: 0, nanoseconds: 0 }),
    updated_at: typeof raw.updated_at === 'string' 
      ? convertIsoToTimestamp(raw.updated_at) 
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
    return new Date(timestamp).getTime();
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

  console.log(`  🔍 Comparing:`);
  console.log(`    A: ${a.title?.substring(0, 20)}... date=${a.date}, updated_at=${JSON.stringify(a.updated_at)}`);
  console.log(`    B: ${b.title?.substring(0, 20)}... date=${b.date}, updated_at=${JSON.stringify(b.updated_at)}`);

  // date가 더 큰 쪽이 최신
  if (a.date > b.date) {
    console.log(`    → A is newer (date: ${a.date} > ${b.date})`);
    return 1;
  }
  if (a.date < b.date) {
    console.log(`    → B is newer (date: ${a.date} < ${b.date})`);
    return -1;
  }

  console.log(`    → Dates are equal, comparing updated_at...`);
  
  // date가 같으면 updatedAt 비교
  const aTime = convertToComparableTimestamp(a.updated_at);
  const bTime = convertToComparableTimestamp(b.updated_at);
  
  if (aTime > bTime) {
    console.log(`    → A is newer (updated_at)`);
    return 1;
  }
  if (aTime < bTime) {
    console.log(`    → B is newer (updated_at)`);
    return -1;
  }

  console.log(`    → Both are equal`);
  // 완전히 같으면 0
  return 0;
}