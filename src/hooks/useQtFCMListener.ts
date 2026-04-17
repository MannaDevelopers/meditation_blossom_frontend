import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import logger from '../utils/logger';

export function useQtFCMListener(onUpdate: () => void | Promise<unknown>): void {
  useEffect(() => {
    const { MyEventModule } = NativeModules;
    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }
    const emitter = new NativeEventEmitter(MyEventModule);
    const sub = emitter.addListener('ON_QT_UPDATE', () => {
      logger.log(`${Platform.OS} FCM QT update received`);
      onUpdate();
    });
    return () => sub.remove();
  }, [onUpdate]);
}
