// 타입 정의
export interface Sermon {
  id: string;
  title: string;
  content: string;
  date: string; // 설교 날짜 (YYYY-MM-DD)
  category?: string; // 설교 카테고리
  day_of_week?: string; // 요일 (예: "SUN")
  created_at: number; // Firestore 타임스탬프 (초 단위)
  updated_at: number; // Firestore 타임스탬프 (초 단위)
}

// 메타데이터 타입 정의
export interface SermonMetadata {
  latestDate: string; // 가장 최근 날짜 (YYYY-MM-DD)
  lastUpdated: string;
  totalCount: number;
}

// 스토리지 키
export const STORAGE_KEY = 'sermons_data';
export const METADATA_KEY = 'sermons_metadata';