import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
// import Icon from 'react-native-vector-icons/AntDesign';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocsFromCache, getDocsFromServer, getFirestore, limit, orderBy, query } from '@react-native-firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { RootStackParamList } from '../types/navigation';
import { FCM_SERMON_KEY, firestoreDocToSermon, Sermon } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';


type Props = NativeStackScreenProps<RootStackParamList, 'HomeScreen'>;

const HomeScreen = ({ navigation }: Props) => {
  const [sermon, setSermon] = useState<Sermon | null>(null);


  const latestSermonFromFirestoreCache = async (): Promise<Sermon | null> => {
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'sermons'),
        orderBy('date', 'desc'),
        limit(1)
      )
      const latestSermonSnapshot = await getDocsFromCache(q);

      if (!latestSermonSnapshot.empty) {
        return firestoreDocToSermon(latestSermonSnapshot.docs[0]);
      } else {
        return null;
      }
    } catch (error) {
      console.error('failed to load latest sermon from firestore', error);
      return null;
    }
  }

  const latestSermonFromAsyncStorage = async (): Promise<Sermon | null> => {
    try {
      const latestSermon = await AsyncStorage.getItem(FCM_SERMON_KEY);
      if (latestSermon) {
        return JSON.parse(latestSermon) as Sermon;
      }
    } catch (error) {
      console.error('failed to load latest sermon from async storage', error);
      return null;
    }
    return null;
  }

  // 로컬 데이터 로드
  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    console.log('Loading local data...');

    const firestoreCache: Sermon | null = await latestSermonFromFirestoreCache();
    const asyncStorageCache: Sermon | null = await latestSermonFromAsyncStorage();

    let selectedSermon: Sermon | null = null;
    if (asyncStorageCache == null) {
      selectedSermon = firestoreCache;
      console.log('Selected Firestore cache (AsyncStorage is null)');
    } else if (firestoreCache == null) {
      selectedSermon = asyncStorageCache;
      console.log('Selected AsyncStorage cache (Firestore is null)');
    } else if (firestoreCache.date >= asyncStorageCache.date) {
      selectedSermon = firestoreCache;
      console.log('Selected Firestore cache (newer or same date)');
    } else {
      selectedSermon = asyncStorageCache;
      console.log('Selected AsyncStorage cache (newer date)');
    }

    setSermon(selectedSermon);
    return selectedSermon;
  }, []);

  // 서버에서 데이터 가져오기
  const fetchDataFromServer = useCallback(async () => {
    console.log('Fetching data from server...');
    try {

      const db = getFirestore();
      const q = query(
        collection(db, 'sermons'),
        orderBy('date', 'desc'),
        limit(1)
      )
      const snapshot = await getDocsFromServer(q);

      console.log(`Fetched ${snapshot.docs.length} sermons from server`);

      if (snapshot.empty) {
        console.log('No new sermons found');
        return;
      }

      const latestSermon = firestoreDocToSermon(snapshot.docs[0]);
      setSermon(latestSermon);
    } catch (error) {
      console.error('Error fetching sermons:', error);
    }
  }, []);

  // 새로고침 핸들러
  const onRefresh = useCallback(async () => {
    await fetchDataFromServer();
  }, [fetchDataFromServer]);


  // 제목 텍스트 처리 - 소괄호 부분을 줄바꿈
  const processTitleText = (title: string | undefined): string => {
    if (!title) return '';

    // 소괄호를 찾아서 줄바꿈 추가
    return title.replace(/\(/g, '\n(').replace(/\)/g, ')');
  };

  const checkInvalidate = (latestSermonDate: Date | null): boolean => {
    if (latestSermonDate == null)
      return true;

    // 현재 날짜와 최신 날짜를 비교
    const currentDate = new Date();
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(currentDate.getDate() - 7);

    console.log('Current Date:', currentDate.toISOString());
    console.log('Latest Sermon Date:', latestSermonDate.toISOString());

    // 최신 날짜가 1주일 전보다 이전이면 서버에서 데이터 요청
    if (latestSermonDate <= oneWeekAgo) {
      console.log('Fetching data from server due to outdated latest date');
      return true;
    }
    return false;
  }

  // 초기 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      const sermon = await loadLocalData();
      const latestDate = sermon?.date ? new Date(sermon.date) : null;
      if (checkInvalidate(latestDate)) {
        await fetchDataFromServer();
      }
    };

    initializeData();
  }, [loadLocalData, fetchDataFromServer]);


  useEffect(() => {
    const updateWidget = async () => {
      try {
        if (sermon != null) {
          await WidgetUpdateModule.onSermonUpdated(JSON.stringify(sermon));
        }
        console.log('Widget updated successfully');
      } catch (error) {
        console.error('Failed to update widgets:', error);
      }
    };

    updateWidget();
  }, [sermon]);

  // // FCM 메시지 이벤트 처리
  // useEffect(() => {
  //   // FCM 권한 요청
  //   const requestUserPermission = async () => {
  //     try {
  //       const authStatus = await messaging().requestPermission();
  //       const enabled =
  //         authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
  //         authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  //       console.log('FCM Authorization status:', authStatus);
  //       console.log('FCM enabled:', enabled);

  //       if (enabled) {
  //         // FCM 토큰 가져오기
  //         const token = await messaging().getToken();
  //         console.log('FCM Token:', token);

  //         // sermon_events 토픽 구독
  //         await messaging().subscribeToTopic('sermon_events');
  //         console.log('Subscribed to sermon_events topic');

  //         // 백그라운드 FCM 메시지 로그 확인 (AsyncStorage)
  //         try {
  //           const backgroundMessages = await AsyncStorage.getItem('backgroundFCMMessages');
  //           if (backgroundMessages) {
  //             const messages = JSON.parse(backgroundMessages);
  //             console.log('[AsyncStorage] Background FCM messages log:', messages);
  //           }
  //         } catch (error) {
  //           console.log('[AsyncStorage] No background FCM messages log found');
  //         }

  //         // 네이티브 FCM 로그 확인 (SharedPreferences)
  //         try {
  //           const fcmCheckResult = await NativeModules.FCMCheckModule.checkFCMReceived();
  //           console.log('[Native] FCM check result:', fcmCheckResult);

  //           // FCM으로 받은 새로운 설교가 있으면 처리
  //           if (fcmCheckResult.fcmReceived) {
  //             console.log('[Native] New FCM sermon received, processing...');
  //             await processNativeFCMSermon();
  //           }
  //         } catch (error) {
  //           console.log('[Native] FCM check failed:', error);
  //         }
  //       } else {
  //         console.log('FCM permission denied');
  //       }
  //     } catch (error) {
  //       console.error('Error requesting FCM permission:', error);
  //     }
  //   };

  //   requestUserPermission();

  //   const unsubscribe = messaging().onMessage(async remoteMessage => {
  //     console.log('=== FCM FOREGROUND MESSAGE RECEIVED ===');
  //     console.log('FCM message received in foreground:', remoteMessage);

  //     // sermon_events 토픽에서 온 메시지인지 확인
  //     if (remoteMessage.from === '/topics/sermon_events') {
  //       console.log('Sermon event received via FCM, updating data...');

  //       // FCM 메시지에서 받은 데이터로 새로운 설교 생성
  //       const sermonData = remoteMessage.data as Record<string, string>;
  //       if (sermonData && sermonData.date && sermonData.title && sermonData.content) {
  //         const newSermon: Sermon = {
  //           id: `fcm_${Date.now()}`, // 임시 ID 생성
  //           title: sermonData.title,
  //           content: sermonData.content,
  //           date: sermonData.date,
  //           category: sermonData.category || '',
  //           day_of_week: sermonData.day_of_week || '',
  //           created_at: { seconds: Date.now() / 1000, nanoseconds: 0 },
  //           updated_at: { seconds: Date.now() / 1000, nanoseconds: 0 }
  //         };

  //         console.log('New sermon from FCM:', newSermon);

  //         // 기존 설교 목록에 새 설교 추가
  //         const updatedSermons = [newSermon, ...sermons];
  //         setSermons(updatedSermons);

  //         // AsyncStorage에 저장
  //         await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSermons));

  //         // 메타데이터 업데이트
  //         const newLatestDate = newSermon.date;
  //         const newMetadata: SermonMetadata = {
  //           latestDate: newLatestDate,
  //           lastUpdated: new Date().toISOString()
  //         };
  //         await saveMetadata(newMetadata);

  //         // 위젯 업데이트
  //         try {
  //           console.log('[React Native] Calling WidgetUpdateModule.onSermonUpdated...');
  //           console.log('[React Native] Sermon data to send:', JSON.stringify(newSermon));
  //           WidgetUpdateModule.onSermonUpdated(JSON.stringify(newSermon))
  //           // // 방법 1: 기존 네이티브 모듈 호출
  //           // await new Promise<void>((resolve, reject) => {
  //           //   console.log('[React Native] Promise created, calling native module...');
  //           //   WidgetUpdateModule.onSermonUpdated(JSON.stringify(newSermon))
  //           //     .then(() => {
  //           //       console.log('[React Native] Widget updated via FCM successfully');
  //           //       resolve();
  //           //     })
  //           //     .catch((error) => {
  //           //       console.error('[React Native] Failed to update widgets via FCM:', error);
  //           //       reject(error);
  //           //     });
  //           // });
  //           // console.log('[React Native] Promise resolved successfully');

  //           // // 방법 2: 직접 위젯 업데이트 시도 (백업)
  //           // try {
  //           //   console.log('[React Native] Trying direct widget update as backup...');
  //           //   const { NativeModules } = require('react-native');
  //           //   if (NativeModules.WidgetUpdateModule) {
  //           //     console.log('[React Native] WidgetUpdateModule found, calling directly...');
  //           //     await NativeModules.WidgetUpdateModule.onSermonUpdated(JSON.stringify(newSermon));
  //           //     console.log('[React Native] Direct widget update completed');
  //           //   } else {
  //           //     console.log('[React Native] WidgetUpdateModule not found in NativeModules');
  //           //   }
  //           // } catch (directError) {
  //           //   console.error('[React Native] Direct widget update failed:', directError);
  //           // }
  //         } catch (error) {
  //           console.error('[React Native] Failed to update widgets via FCM:', error);
  //         }
  //       }
  //     }
  //   });

  //   return unsubscribe;
  // }, []);

  // // 앱 상태 변경 감지 (백그라운드에서 포그라운드로 돌아올 때)
  // useEffect(() => {
  //   const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  //     console.log('[AppState] App state changed from', appState.current, 'to', nextAppState);

  //     if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
  //       console.log('[AppState] App has come to the foreground!');

  //       // 앱이 포그라운드로 돌아왔을 때 FCM 데이터 확인
  //       try {
  //         const fcmCheckResult = await NativeModules.FCMCheckModule.checkFCMReceived();
  //         console.log('[AppState] FCM check result:', fcmCheckResult);

  //         if (fcmCheckResult.fcmReceived) {
  //           console.log('[AppState] New FCM sermon received while app was in background');
  //           await processNativeFCMSermon();
  //         }
  //       } catch (error) {
  //         console.log('[AppState] FCM check failed:', error);
  //       }
  //     }

  //     appState.current = nextAppState;
  //   };

  //   const subscription = AppState.addEventListener('change', handleAppStateChange);

  //   return () => {
  //     subscription?.remove();
  //   };
  // }, []);

  // // 네이티브 FCM에서 받은 설교 데이터 처리
  // const processNativeFCMSermon = async () => {
  //   try {
  //     console.log('[React Native] Processing native FCM sermon...');

  //     // 네이티브에서 저장한 최신 설교 데이터 가져오기
  //     const sermonResult = await NativeModules.FCMCheckModule.getLatestSermonFromNative();
  //     console.log('[React Native] Sermon result from native:', sermonResult);

  //     if (sermonResult.hasData && sermonResult.sermonData) {
  //       const newSermon: Sermon = JSON.parse(sermonResult.sermonData);
  //       console.log('[React Native] New sermon from native FCM:', newSermon);

  //       // 기존 설교 목록에 새 설교 추가
  //       const updatedSermons = [newSermon, ...sermons];
  //       setSermons(updatedSermons);

  //       // AsyncStorage에 저장
  //       await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSermons));

  //       // 메타데이터 업데이트
  //       const newLatestDate = newSermon.date;
  //       const newMetadata: SermonMetadata = {
  //         latestDate: newLatestDate,
  //         lastUpdated: new Date().toISOString()
  //       };
  //       await saveMetadata(newMetadata);

  //       // 위젯 업데이트
  //       try {
  //         await new Promise<void>((resolve, reject) => {
  //           WidgetUpdateModule.onSermonUpdated(JSON.stringify(newSermon))
  //             .then(() => {
  //               console.log('[React Native] Widget updated via native FCM successfully');
  //               resolve();
  //             })
  //             .catch((error) => {
  //               console.error('[React Native] Failed to update widgets via native FCM:', error);
  //               reject(error);
  //             });
  //         });
  //       } catch (error) {
  //         console.error('[React Native] Failed to update widgets via native FCM:', error);
  //       }

  //       console.log('[React Native] Native FCM sermon processed successfully');
  //     } else {
  //       console.log('[React Native] No native FCM sermon data found');
  //     }
  //   } catch (error) {
  //     console.error('[React Native] Error processing native FCM sermon:', error);
  //   }
  // };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent', marginHorizontal: 35, marginVertical: 35, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'transparent', flex: 1 }}>
        <View style={{ backgroundColor: 'transparent', flexDirection: 'row', width: 305, height: 30, marginBottom: 35, alignItems: 'center' }}>
          <Image source={require('../assets/image/20250416_meditation_icon.png')} style={{ backgroundColor: 'transparent', borderRadius: 15, width: 20, height: 20 }} />
          <Text style={{ color: '#49454F', fontSize: 20, fontFamily: "Pretendard-Medium", marginLeft: 8 }}>묵상만개</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SettingsScreen', { onRefresh })} style={{ marginLeft: 'auto' }}>
            <SvgIcon name="SettingButton" size={20} color='black' />
          </TouchableOpacity>
        </View>
        <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, height: 25 }}>
          <Text style={{ color: "#A59EAE", fontSize: 20, fontFamily: "Pretendard-SemiBold" }}>{sermon?.date}</Text>
        </View>
        <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, minHeight: 30, paddingVertical: 5 }}>
          <Text style={{ color: "#A59EAE", fontSize: 24, fontFamily: "Pretendard-Bold", textAlign: 'center', flexWrap: 'wrap' }} numberOfLines={0}>{processTitleText(sermon?.title)}</Text>
        </View>
        <View style={{ backgroundColor: 'transparent', width: 305, height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <WidgetPreview content={sermon?.content} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default HomeScreen