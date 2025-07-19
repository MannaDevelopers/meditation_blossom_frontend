/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sermon, SermonMetadata, STORAGE_KEY, METADATA_KEY, DISPLAY_SERMON_KEY } from './src/types/Sermon'
import WidgetUpdateModule, { FCMCheckModuleInterface } from './src/types/WidgetUpdateModule';

// 백그라운드 FCM 메시지는 네이티브 MyFirebaseMessagingService에서 처리됩니다.
// React Native의 setBackgroundMessageHandler는 제거하여 충돌을 방지합니다.

AppRegistry.registerComponent(appName, () => App);
