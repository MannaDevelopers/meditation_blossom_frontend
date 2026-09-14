import { TurboModuleRegistry } from 'react-native';
import type { Spec } from '../specs/NativeWidgetUpdateModule';

const WidgetUpdateModule = TurboModuleRegistry.get<Spec>('WidgetUpdateModule');

export default WidgetUpdateModule;
