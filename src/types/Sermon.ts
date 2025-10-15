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

// 메타데이터 타입 정의
export interface SermonMetadata {
  latestDate: string; // 가장 최근 날짜 (YYYY-MM-DD)
  lastUpdated: string;
}

// 스토리지 키
export const FCM_SERMON_KEY = 'fcm_sermon';


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
  if (a.updated_at > b.updated_at) {
    console.log(`    → A is newer (updated_at)`);
    return 1;
  }
  if (a.updated_at < b.updated_at) {
    console.log(`    → B is newer (updated_at)`);
    return -1;
  }

  console.log(`    → Both are equal`);
  // 완전히 같으면 0
  return 0;
}