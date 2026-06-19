import { useCallback, useEffect, useRef, useState } from 'react';
import { compareQt, QT } from '../types/QT';
import {
  fetchLatestQtFromAsyncStorage,
  fetchLatestQtFromServer,
  saveQtToAsyncStorage,
  subscribeToLatestQt,
} from '../services/qtService';
import { logAnalytics } from '../utils/analytics';
import logger from '../utils/logger';
import { reconcileFreshDoc } from '../utils/reconcileFreshDoc';

export interface UseQtDataReturn {
  qt: QT | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  loadLocalData: () => Promise<QT | null>;
  fetchFromServer: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function useQtData(): UseQtDataReturn {
  const [qt, setQt] = useState<QT | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qtRef = useRef<QT | null>(null);
  qtRef.current = qt;
  // video_url/content 보충용 서버 강제 조회를 세션당 1회로 제한 (영상이 원래 없는 항목에서 반복 조회 방지)
  const triedServerFill = useRef(false);

  const loadLocalData = useCallback(async (): Promise<QT | null> => {
    try {
      const selected = await fetchLatestQtFromAsyncStorage();
      logger.log('AsyncStorage qt:', selected ? selected.date : 'null');
      setQt(selected);
      setError(null);

      // 로컬에 video_url/content/series_title/meditation_questions가 비면 Firestore 강제 조회로 보충
      // (onSnapshot은 웜스타트 캐시 시 안 옴). reconcileFreshDoc로 빈 칸만 머지, 세션당 1회.
      // series_title/meditation_questions는 iOS FCM 저장 경로에서 누락될 수 있어 첫 설치 시 빈 채로 남는다(#144).
      const missingField =
        !selected?.video_url ||
        !selected?.content ||
        !selected?.series_title ||
        !selected?.meditation_questions;
      if (selected && missingField && !triedServerFill.current) {
        triedServerFill.current = true;
        try {
          const fresh = await fetchLatestQtFromServer();
          const next = fresh ? reconcileFreshDoc(fresh, selected, compareQt) : null;
          if (next) {
            logger.log('[loadLocalData] 로컬 qt video_url/content 누락 → 서버에서 보충함');
            await saveQtToAsyncStorage(next);
            setQt(next);
            return next;
          }
        } catch (fillErr) {
          logger.warn('useQtData: 서버 보충 조회 실패 (offline?)', fillErr);
        }
      }

      return selected;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to load QT local data:', e);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFromServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchLatestQtFromServer();
      if (result) {
        await saveQtToAsyncStorage(result);
        setQt(result);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to fetch QT from server:', e);
      setError(message);
      logAnalytics.dataLoadFailed('qt');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return subscribeToLatestQt(
      async (fresh) => {
        // 통째 교체 대신 reconcileFreshDoc로 머지: 같은 날짜의 서버 snapshot이
        // FCM에서 온 meditation_questions/series_title를 덮어 유실시키지 않도록 한다(#144).
        const next = reconcileFreshDoc(fresh, qtRef.current, compareQt);
        if (next) {
          logger.log('onSnapshot: QT reconciled, updating');
          await saveQtToAsyncStorage(next);
          setQt(next);
        }
      },
      (e) => logger.error('Firestore QT subscription error:', e),
    );
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchFromServer();
  }, [fetchFromServer]);

  return { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh };
}
