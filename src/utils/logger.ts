import crashlytics from '@react-native-firebase/crashlytics';

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
  },
  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error(...args);
    }
    const message = args.map(a => a instanceof Error ? a.message : String(a)).join(' ');
    crashlytics().log(message);
    const err = args.find(a => a instanceof Error);
    crashlytics().recordError(err instanceof Error ? err : new Error(message));
  },
};

export default logger;
