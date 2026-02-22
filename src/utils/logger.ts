import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Logger utility.
 * - log: console only in dev, silent in production.
 * - warn: console in dev + crashlytics().log() in all builds.
 * - error: console in dev + crashlytics().log() in all builds + recordError only when Error instance found.
 */
const logger = {
  log: (...args: unknown[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) {
      console.warn(...args);
    }
    const message = args.map(a => a instanceof Error ? a.message : String(a)).join(' ');
    crashlytics().log(`[WARN] ${message}`);
  },
  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error(...args);
    }
    const message = args.map(a => a instanceof Error ? a.message : String(a)).join(' ');
    crashlytics().log(message);
    const err = args.find(a => a instanceof Error);
    if (err instanceof Error) {
      crashlytics().recordError(err);
    }
  },
};

export default logger;
