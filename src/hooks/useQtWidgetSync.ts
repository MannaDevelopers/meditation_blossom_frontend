import { useEffect } from 'react';
import { QT } from '../types/QT';
import { pushQtToWidget } from '../services/qtService';
import logger from '../utils/logger';

export function useQtWidgetSync(qt: QT | null): void {
  useEffect(() => {
    if (!qt) return;
    pushQtToWidget(qt).catch((error) => {
      logger.error('Failed to update QT widget:', error);
    });
  }, [qt]);
}
