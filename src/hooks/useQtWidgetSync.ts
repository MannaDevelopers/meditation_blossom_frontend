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
    let parsedMeditationQuestions: string[] = [];
    const raw = qt.meditation_questions;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsedMeditationQuestions = parsed;
        } else if (typeof parsed === 'string') {
          parsedMeditationQuestions = parsed.split('\n').filter(Boolean);
        }
      } catch {
        // FCM 경로: meditation_questions가 한국어 평문인 경우
        parsedMeditationQuestions = raw.split('\n').filter(Boolean);
      }
    }
    const payload = {
      ...qt,
      meditation_questions: parsedMeditationQuestions,
    };
    WidgetUpdateModule.onQtUpdated(JSON.stringify(payload)).catch((error) => {
      logger.error('Failed to update QT widget:', error);
    });
  }, [qt]);
}
