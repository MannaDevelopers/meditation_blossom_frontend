import { NativeModules } from 'react-native';

interface WidgetUpdateModuleInterface {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onQtUpdated(qtData: string): Promise<boolean>;
  resolveBibleReferences(jsonString: string): Promise<string>;
  onClear(): Promise<void>;
  getAppGroupData(key: string): Promise<string | null>;
  setYoutubeLinkEnabled(enabled: boolean): Promise<void>;
  getYoutubeLinkEnabled(): Promise<boolean>;
}

const { WidgetUpdateModule } = NativeModules;

export default WidgetUpdateModule as WidgetUpdateModuleInterface;
