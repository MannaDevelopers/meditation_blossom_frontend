import { useCallback, useEffect, useRef, useState } from 'react';
import { compareSermon, Sermon } from '../types/Sermon';
import {
  fetchLatestSermonFromAsyncStorage,
  fetchLatestSermonFromServer,
  saveSermonToAsyncStorage,
  subscribeToLatestSermon,
} from '../services/sermonService';
import { logAnalytics } from '../utils/analytics';
import logger from '../utils/logger';
import { reconcileFreshDoc } from '../utils/reconcileFreshDoc';

export interface UseSermonDataReturn {
  sermon: Sermon | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  loadLocalData: () => Promise<Sermon | null>;
  fetchFromServer: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function useSermonData(): UseSermonDataReturn {
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sermonRef = useRef<Sermon | null>(null);
  sermonRef.current = sermon;
  // video_url/content 보충용 서버 강제 조회를 세션당 1회로 제한 (영상이 원래 없는 설교에서 반복 조회 방지)
  const triedServerFill = useRef(false);

  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    try {
      const selected = await fetchLatestSermonFromAsyncStorage();

      logger.log('AsyncStorage sermon:', selected ? selected.date : 'null');

      setSermon(selected);
      setError(null);

      // 로컬 데이터에 video_url/content가 비어 있으면 Firestore에서 강제 조회해 보충한다.
      // onSnapshot은 웜스타트(Firestore 캐시) 시 콜백이 오지 않아 보충이 안 되므로 서버 강제 조회가 필요.
      // (수동 "데이터 새로고침"과 동일 경로) reconcileFreshDoc로 빈 칸만 머지, 세션당 1회만 시도.
      if (selected && (!selected.video_url || !selected.content) && !triedServerFill.current) {
        triedServerFill.current = true;
        try {
          const fresh = await fetchLatestSermonFromServer();
          const next = fresh ? reconcileFreshDoc(fresh, selected, compareSermon) : null;
          if (next) {
            logger.log('[loadLocalData] 로컬 video_url/content 누락 → 서버에서 보충함');
            await saveSermonToAsyncStorage(next);
            setSermon(next);
            return next;
          }
        } catch (fillErr) {
          logger.warn('useSermonData: 서버 보충 조회 실패 (offline?)', fillErr);
        }
      }

      return selected;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to load local data:', e);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFromServer = useCallback(async () => {
    logger.log('[SermonData] fetchFromServer: start');
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchLatestSermonFromServer();
      logger.log('[SermonData] fetchFromServer: result=' + (result?.date ?? 'null'));
      if (result) {
        await saveSermonToAsyncStorage(result);
        setSermon(result);
        logger.log('[SermonData] fetchFromServer: setSermon called');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to fetch from server:', e);
      setError(message);
      logAnalytics.dataLoadFailed('sermon');
    } finally {
      setIsLoading(false);
      logger.log('[SermonData] fetchFromServer: done, isLoading=false');
    }
  }, []);

  useEffect(() => {
    return subscribeToLatestSermon(
      async (fresh) => {
        if (compareSermon(fresh, sermonRef.current) > 0) {
          logger.log('onSnapshot: newer sermon received, updating');
          await saveSermonToAsyncStorage(fresh);
          setSermon(fresh);
        }
      },
      (e) => logger.error('Firestore subscription error:', e),
    );
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchFromServer();
  }, [fetchFromServer]);

  return { sermon, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh };
}
