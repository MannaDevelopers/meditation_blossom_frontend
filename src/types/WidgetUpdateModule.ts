import { NativeModules } from 'react-native';

interface WidgetUpdateModuleInterface {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onClear(): Promise<void>;
  getAppGroupData(key: string): Promise<string | null>;
}

const { WidgetUpdateModule } = NativeModules;

export default WidgetUpdateModule as WidgetUpdateModuleInterface;
