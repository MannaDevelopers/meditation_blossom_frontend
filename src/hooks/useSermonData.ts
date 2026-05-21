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

  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    try {
      const selected = await fetchLatestSermonFromAsyncStorage();

      logger.log('AsyncStorage sermon:', selected ? selected.date : 'null');

      setSermon(selected);
      setError(null);
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
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchLatestSermonFromServer();
      if (result) {
        setSermon(result);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to fetch from server:', e);
      setError(message);
      logAnalytics.dataLoadFailed('sermon');
    } finally {
      setIsLoading(false);
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
