import { useCallback, useState } from 'react';
import { compareQt, QT } from '../types/QT';
import {
  fetchLatestQtFromAsyncStorage,
  fetchLatestQtFromCache,
  fetchLatestQtFromServer,
} from '../services/qtService';
import logger from '../utils/logger';

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

  const loadLocalData = useCallback(async (): Promise<QT | null> => {
    try {
      const [firestoreCache, asyncStorageCache] = await Promise.all([
        fetchLatestQtFromCache(),
        fetchLatestQtFromAsyncStorage(),
      ]);

      if (!firestoreCache && !asyncStorageCache) {
        setQt(null);
        return null;
      }

      const result = compareQt(firestoreCache, asyncStorageCache);
      const selected = result >= 0 ? firestoreCache : asyncStorageCache;
      setQt(selected);
      setError(null);
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
      if (result) setQt(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to fetch QT from server:', e);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchFromServer();
  }, [fetchFromServer]);

  return { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh };
}
