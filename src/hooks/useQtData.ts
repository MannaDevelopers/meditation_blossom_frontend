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

  const loadLocalData = useCallback(async (): Promise<QT | null> => {
    try {
      const selected = await fetchLatestQtFromAsyncStorage();
      logger.log('AsyncStorage qt:', selected ? selected.date : 'null');
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
        if (compareQt(fresh, qtRef.current) > 0) {
          logger.log('onSnapshot: newer QT received, updating');
          await saveQtToAsyncStorage(fresh);
          setQt(fresh);
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
