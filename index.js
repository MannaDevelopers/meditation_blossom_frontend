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

  // 메타데이터 저장
  const saveMetadata = async (newMetadata) => {
    try {
      await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(newMetadata));
      console.log('Metadata saved:', newMetadata);
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  };


// 백그라운드/종료 상태에서 FCM 메시지 수신 시 호출됨
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('FCM from background:', remoteMessage);

  // 메시지의 데이터 payload 확인
  if (remoteMessage && remoteMessage.data) {
    // console.log('Background message data (FCM):', remoteMessage.data);
    // console.log("RemoteMessage.from:", remoteMessage.from);
    if (!(remoteMessage.from == '/topics/sermon_events')) return;

    console.log("(Background FCM) Updating Sermons Storage")

    // FCM 메시지에서 받은 데이터로 새로운 설교 생성
    const sermonData = remoteMessage.data;
    if (sermonData && sermonData.date && sermonData.title && sermonData.content) {
      const newSermon = {
        id: `fcm_${Date.now()}`, // 임시 ID 생성
        title: sermonData.title,
        content: sermonData.content,
        date: sermonData.date,
        category: sermonData.category || '',
        day_of_week: sermonData.day_of_week || '',
        created_at: { seconds: Date.now() / 1000, nanoseconds: 0 },
        updated_at: { seconds: Date.now() / 1000, nanoseconds: 0 }
      };
      
      console.log('New sermon from FCM:', newSermon);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      let sermons=[];
      if (data) {
        const parsedData = await JSON.parse(data);
        sermons = parsedData;
      }

      const updatedSermons = [newSermon, ...sermons];

      // AsyncStorage에 저장
      await AsyncStorage.setItem(STORAGE_KEY, await JSON.stringify(updatedSermons));

      // 메타데이터 업데이트
      const newLatestDate = newSermon.date;
      const newMetadata = {
          latestDate: newLatestDate,
          lastUpdated: new Date().toISOString(),
          totalCount: updatedSermons.length
      };
      await saveMetadata(newMetadata);

      // 위젯 업데이트
      try {
      await WidgetUpdateModule.onSermonUpdated(JSON.stringify(newSermon));
      console.log('Widget updated via FCM');
      } catch (error) {
      console.error('Failed to update widgets via FCM:', error);
      }
    }

  }

  if (remoteMessage && remoteMessage.data) {
    try {
      const prev = await AsyncStorage.getItem('backgroundFCMMessages');
      let messages = [];
      if (prev) {
        messages = JSON.parse(prev);
      }
      messages.push({
        receivedAt: new Date().toISOString(),
        data: remoteMessage.data,
      });
      await AsyncStorage.setItem('backgroundFCMMessages', JSON.stringify(messages));
      console.log('AsyncStorage Stored');
    } catch (e) {
      console.error('Fail to save data:', e);
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
