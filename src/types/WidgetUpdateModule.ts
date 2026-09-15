import { TurboModuleRegistry } from 'react-native';
import type { Spec } from '../specs/NativeWidgetUpdateModule';

const WidgetUpdateModule = TurboModuleRegistry.getEnforcing<Spec>('WidgetUpdateModule');

export default WidgetUpdateModule;
