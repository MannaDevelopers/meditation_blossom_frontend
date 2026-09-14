import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Android 전용. NativeEventEmitter가 요구하는 addListener/removeListeners는
// 실제 구독 로직 없이 spec 계약 충족용으로만 존재한다 (RN 0.65+ 요구사항).
export interface Spec extends TurboModule {
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MyEventModule');
