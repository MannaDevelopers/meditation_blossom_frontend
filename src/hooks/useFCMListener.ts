import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import logger from '../utils/logger';

export function useFCMListener(onUpdate: () => void): void {
  useEffect(() => {
    const { MyEventModule } = NativeModules;

    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }

    const eventEmitter = new NativeEventEmitter(MyEventModule);
    const subscription = eventEmitter.addListener('ON_SERMON_UPDATE', () => {
      logger.log(`${Platform.OS} FCM sermon update received`);
      onUpdate();
    });

    return () => {
      subscription.remove();
    };
  }, [onUpdate]);
}
