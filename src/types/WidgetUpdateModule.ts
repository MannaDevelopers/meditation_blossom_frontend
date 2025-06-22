import { NativeModules } from 'react-native';

interface WidgetUpdateModuleInterface {
  onSermonUpdated(sermonData: string): Promise<boolean>;
}

const { WidgetUpdateModule } = NativeModules;

export default WidgetUpdateModule as WidgetUpdateModuleInterface; 