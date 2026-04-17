import { useEffect } from 'react';
import { QT } from '../types/QT';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';

export function useQtWidgetSync(qt: QT | null): void {
  useEffect(() => {
    if (!qt) return;
    if (!WidgetUpdateModule?.onQtUpdated) {
      logger.error('WidgetUpdateModule.onQtUpdated is not available');
      return;
    }
    WidgetUpdateModule.onQtUpdated(JSON.stringify(qt)).catch((error) => {
      logger.error('Failed to update QT widget:', error);
    });
  }, [qt]);
}
