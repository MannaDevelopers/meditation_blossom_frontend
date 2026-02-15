import { useCallback, useState } from 'react';
import { compareSermon, Sermon } from '../types/Sermon';
import {
  fetchLatestSermonFromAsyncStorage,
  fetchLatestSermonFromCache,
  fetchLatestSermonFromServer,
} from '../services/sermonService';
import logger from '../utils/logger';

export interface UseSermonDataReturn {
  sermon: Sermon | null;
  isLoading: boolean;
  error: string | null;
  loadLocalData: () => Promise<Sermon | null>;
  fetchFromServer: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function useSermonData(): UseSermonDataReturn {
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    try {
      const [firestoreCache, asyncStorageCache] = await Promise.all([
        fetchLatestSermonFromCache(),
        fetchLatestSermonFromAsyncStorage(),
      ]);

      logger.log(
        'Data sources:',
        firestoreCache ? `Firestore(${firestoreCache.date})` : 'Firestore(null)',
        asyncStorageCache ? `AsyncStorage(${asyncStorageCache.date})` : 'AsyncStorage(null)',
      );

      if (!firestoreCache && !asyncStorageCache) {
        setSermon(null);
        return null;
      }

      const result = compareSermon(firestoreCache, asyncStorageCache);
      const selected = result >= 0 ? firestoreCache : asyncStorageCache;

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchFromServer();
  }, [fetchFromServer]);

  return { sermon, isLoading, error, loadLocalData, fetchFromServer, onRefresh };
}
