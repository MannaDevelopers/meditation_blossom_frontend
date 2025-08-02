import { NativeModules } from 'react-native';

interface WidgetUpdateModuleInterface {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onClear(): Promise<void>;
}

interface FCMCheckModuleInterface {
  checkFCMReceived(): Promise<{
    fcmReceived: boolean;
    fcmTimestamp: number;
  }>;
}

const { WidgetUpdateModule, FCMCheckModule } = NativeModules;

export default WidgetUpdateModule as WidgetUpdateModuleInterface;
export { FCMCheckModule as FCMCheckModuleInterface }; 