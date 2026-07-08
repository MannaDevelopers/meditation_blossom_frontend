import { useEffect } from 'react';
import { Sermon } from '../types/Sermon';
import { pushSermonToWidget } from '../services/sermonService';
import logger from '../utils/logger';

export function useWidgetSync(sermon: Sermon | null): void {
  useEffect(() => {
    if (!sermon) return;
    logger.log('[useWidgetSync] onSermonUpdated called, date=' + sermon.date);
    pushSermonToWidget(sermon).catch((error) => {
      logger.error('Failed to update widget:', error);
    });
  }, [sermon]);
}
