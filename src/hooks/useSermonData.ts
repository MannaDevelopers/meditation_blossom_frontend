import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { compareSermon, Sermon, WorshipType } from '../types/Sermon';
import {
  fetchLatestSermonFromAsyncStorage,
  fetchLatestSermonFromServer,
  saveSermonToAsyncStorage,
  subscribeToLatestSermon,
  fetchLatestWeeklySermonsFromAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  fetchLatestWeeklySermonsFromServer,
  pushSermonToWidget,
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
      const worshipSetting = (await AsyncStorage.getItem('user_worship_setting')) as WorshipType || 'SUN_1000';
      const weeklySermons = (await fetchLatestWeeklySermonsFromAsyncStorage()) || [];
      let selected = weeklySermons.find(s => s.worship_type === worshipSetting) || null;

      if (!selected) {
        selected = await fetchLatestSermonFromAsyncStorage();
      }

      logger.log('AsyncStorage sermon:', selected ? `${selected.date} (${selected.worship_type || 'legacy'})` : 'null');

      setSermon(selected);
      setError(null);

      // 로컬 데이터에 video_url/content가 비어 있으면 Firestore에서 강제 조회해 보충한다.
      if (selected && (!selected.video_url || !selected.content) && !triedServerFill.current) {
        triedServerFill.current = true;
        try {
          const freshWeekly = await fetchLatestWeeklySermonsFromServer();
          if (freshWeekly && freshWeekly.length > 0) {
            await saveWeeklySermonsToAsyncStorage(freshWeekly);
            const freshSelected = freshWeekly.find(s => s.worship_type === worshipSetting) || freshWeekly[0];
            const next = reconcileFreshDoc(freshSelected, selected, compareSermon);
            if (next) {
              logger.log('[loadLocalData] 로컬 video_url/content 누락 → 서버에서 보충함');
              await saveSermonToAsyncStorage(next);
              setSermon(next);
              return next;
            }
          } else {
            // Legacy fallback
            const fresh = await fetchLatestSermonFromServer();
            const next = fresh ? reconcileFreshDoc(fresh, selected, compareSermon) : null;
            if (next) {
              await saveSermonToAsyncStorage(next);
              setSermon(next);
              return next;
            }
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
      const weeklyResults = (await fetchLatestWeeklySermonsFromServer()) || [];
      logger.log('[SermonData] fetchFromServer: result count=' + weeklyResults.length);
      if (weeklyResults.length > 0) {
        await saveWeeklySermonsToAsyncStorage(weeklyResults);
        const worshipSetting = (await AsyncStorage.getItem('user_worship_setting')) as WorshipType || 'SUN_1000';
        const matched = weeklyResults.find(s => s.worship_type === worshipSetting) || weeklyResults[0];

        await saveSermonToAsyncStorage(matched);
        await pushSermonToWidget(matched);
        setSermon(matched);
        logger.log('[SermonData] fetchFromServer: setSermon called with worship_type=' + matched.worship_type);
      } else {
        // Fallback to legacy single fetch
        const result = await fetchLatestSermonFromServer();
        if (result) {
          await saveSermonToAsyncStorage(result);
          setSermon(result);
        }
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
          logger.log('onSnapshot: newer sermon received, updating weekly cache');
          try {
            const weeklySermons = await fetchLatestWeeklySermonsFromServer();
            if (weeklySermons.length > 0) {
              await saveWeeklySermonsToAsyncStorage(weeklySermons);
              const worshipSetting = (await AsyncStorage.getItem('user_worship_setting')) as WorshipType || 'SUN_1000';
              const matched = weeklySermons.find(s => s.worship_type === worshipSetting) || weeklySermons[0];
              await saveSermonToAsyncStorage(matched);
              await pushSermonToWidget(matched);
              setSermon(matched);
            } else {
              await saveSermonToAsyncStorage(fresh);
              await pushSermonToWidget(fresh);
              setSermon(fresh);
            }
          } catch (err) {
            logger.error('Failed to sync weekly sermons in subscription:', err);
            await saveSermonToAsyncStorage(fresh);
            await pushSermonToWidget(fresh);
            setSermon(fresh);
          }
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
