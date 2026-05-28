import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { readAppGroupData } from '../services/sermonService';
import { FCM_QT_KEY } from '../types/QT';
import logger from '../utils/logger';

export function useQtFCMListener(onUpdate: () => void | Promise<unknown>): void {
  const onEventReceived = useCallback(async () => {
    logger.log(`${Platform.OS} FCM QT update received`);
    // iOS: AppDelegate이 App Group에 올바르게 저장했으므로,
    // AsyncStorage(JS)에 동기화한 뒤 loadLocalData를 호출해 즉시 최신 데이터를 표시
    if (Platform.OS === 'ios') {
      try {
        const qtData = await readAppGroupData(FCM_QT_KEY);
        if (qtData) {
          JSON.parse(qtData); // 유효한 JSON인지 검증
          await AsyncStorage.setItem(FCM_QT_KEY, qtData);
          logger.log('useQtFCMListener: App Group fcm_qt → AsyncStorage 동기화 완료');
        }
      } catch (e) {
        logger.error('useQtFCMListener: App Group 동기화 실패 (비JSON 데이터 또는 읽기 오류)', e);
      }
    }
    await onUpdate();
  }, [onUpdate]);

  useEffect(() => {
    const { MyEventModule } = NativeModules;
    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }
    const emitter = new NativeEventEmitter(MyEventModule);
    const sub = emitter.addListener('ON_QT_UPDATE', onEventReceived);
    return () => sub.remove();
  }, [onEventReceived]);
}
