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