import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onQtUpdated(qtData: string): Promise<boolean>;
  onWidgetDesignUpdated(designData: string): Promise<boolean>;
  resolveBibleReferences(jsonString: string): Promise<string>;
  onClear(): Promise<void>;
  // iOS 전용(App Group 조회). Android는 no-op으로 항상 null을 resolve한다.
  getAppGroupData(key: string): Promise<string | null>;
  setYoutubeLinkEnabled(enabled: boolean): Promise<void>;
  getYoutubeLinkEnabled(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WidgetUpdateModule');
