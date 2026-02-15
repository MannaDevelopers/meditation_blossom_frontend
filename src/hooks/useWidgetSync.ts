import { useEffect } from 'react';
import { Sermon } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';

export function useWidgetSync(sermon: Sermon | null): void {
  useEffect(() => {
    if (!sermon) return;

    WidgetUpdateModule.onSermonUpdated(JSON.stringify(sermon)).catch((error) => {
      logger.error('Failed to update widget:', error);
    });
  }, [sermon]);
}
