import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, NativeEventEmitter, NativeModules, Platform, Text, TouchableOpacity, View } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocsFromCache, getDocsFromServer, getFirestore, limit, orderBy, query } from '@react-native-firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { RootStackParamList } from '../types/navigation';
import { compareSermon, FCM_SERMON_KEY, fcmDataToSermon, firestoreDocToSermon, Sermon, SermonRaw } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';


type Props = NativeStackScreenProps<RootStackParamList, 'HomeScreen'>;

const normalizeValueForSignature = (value: any): any => {
  if (typeof value === 'string') {
    return value.replace(/\r\n/g, '\n');
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValueForSignature);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = normalizeValueForSignature(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const normalizeJsonString = (jsonString: string | null | undefined): string => {
  try {
    if (!jsonString) {
      return '';
    }
    const parsed = JSON.parse(jsonString);
    const sorted = normalizeValueForSignature(parsed);
    return JSON.stringify(sorted);
  } catch (error) {
    logger.error('Failed to normalize JSON string:', error);
    return '';
  }
};

const HomeScreen = ({ navigation }: Props) => {
  logger.log('🚀 HomeScreen component rendering');
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const lastSyncedSignatureRef = React.useRef<string | null>(null);

  const updateLastSyncedSignature = useCallback((signature: string | null) => {
    lastSyncedSignatureRef.current = signature;
  }, []);


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
      logger.error('failed to load latest sermon from firestore', error);
      return null;
    }
  }

  const latestSermonFromAsyncStorage = async (): Promise<Sermon | null> => {
    try {
      const latestSermon = await AsyncStorage.getItem(FCM_SERMON_KEY);
      if (latestSermon) {
        const rawData = JSON.parse(latestSermon) as SermonRaw;
        return fcmDataToSermon(rawData);
      }
    } catch (error) {
      logger.error('failed to load latest sermon from async storage', error);
      return null;
    }
    return null;
  }

  // 로컬 데이터 로드
  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    logger.log('📥 Loading local data...');

    const firestoreCache: Sermon | null = await latestSermonFromFirestoreCache();
    const asyncStorageCache: Sermon | null = await latestSermonFromAsyncStorage();
    
    // 데이터 출력
    logger.log('📊 Data sources:');
    logger.log('  - Firestore cache:', firestoreCache ? `${firestoreCache.title} (${firestoreCache.date})` : 'null');
    logger.log('  - AsyncStorage:', asyncStorageCache ? `${asyncStorageCache.title} (${asyncStorageCache.date})` : 'null');

    if (firestoreCache == null && asyncStorageCache == null) {
      logger.log('❌ No local data found');
      setSermon(null);
      return null;
    }

    // 2개 데이터 중 가장 최신 선택
    const compareResult = compareSermon(firestoreCache, asyncStorageCache);
    logger.log(`🔍 Compare result (firestoreCache vs asyncStorageCache): ${compareResult}`);
    
    let selectedSermon: Sermon | null = null;

    if (compareResult >= 0) {
      selectedSermon = firestoreCache;
      logger.log('✅ Selected Firestore cache');
    } else {
      selectedSermon = asyncStorageCache;
      logger.log('✅ Selected AsyncStorage');
    }
    
    // content 확인
    if (selectedSermon) {
      logger.log(`📝 Content length: ${selectedSermon.content?.length || 0} characters`);
      logger.log(`📝 Content preview (first 200 chars): ${selectedSermon.content?.substring(0, 200) || 'N/A'}`);
    }
    
    setSermon(selectedSermon);
    logger.log(`📌 Final selected sermon: ${selectedSermon?.title} (${selectedSermon?.date})`);
    return selectedSermon;
  }, []);

  // 서버에서 데이터 가져오기
  const fetchDataFromServer = useCallback(async () => {
    logger.log('Fetching data from server...');
    try {

      const db = getFirestore();
      const q = query(
        collection(db, 'sermons'),
        orderBy('date', 'desc'),
        limit(1)
      )
      const snapshot = await getDocsFromServer(q);

      logger.log(`Fetched ${snapshot.docs.length} sermons from server`);

      if (snapshot.empty) {
        logger.log('No new sermons found');
        return;
      }

      const latestDoc = snapshot.docs[0];
      logger.log('🔥 Latest sermon from Firestore (raw doc data):', latestDoc.data());
      logger.log('🔥 Firestore doc id:', latestDoc.id);

      const latestSermon = firestoreDocToSermon(latestDoc);
      logger.log('🔥 Converted Firestore sermon:', latestSermon);
      setSermon(latestSermon);
    } catch (error) {
      logger.error('Error fetching sermons:', error);
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
    return title.replace(/\(/g, '\n(');
  };

  const checkInvalidate = (latestSermonDate: Date | null): boolean => {
    if (latestSermonDate == null)
      return true;

    // 현재 날짜와 최신 날짜를 비교
    const currentDate = new Date();
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(currentDate.getDate() - 7);

    logger.log('Current Date:', currentDate.toISOString());
    logger.log('Latest Sermon Date:', latestSermonDate.toISOString());

    // 최신 날짜가 1주일 전보다 이전이면 서버에서 데이터 요청
    if (latestSermonDate <= oneWeekAgo) {
      logger.log('Fetching data from server due to outdated latest date');
      return true;
    }
    return false;
  }

  // 초기 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      logger.log('🚀 initializeData: Starting app initialization...');
      
      try {
        // iOS: 앱 시작 시 App Group 데이터를 먼저 확인하고 AsyncStorage로 복사
        // React Native Bridge가 초기화될 때까지 약간의 지연 후 실행
        if (Platform.OS === 'ios') {
          try {
            logger.log('📱 iOS detected, waiting for Bridge initialization...');
            
            // Bridge 초기화 대기 (약 100ms)
            await new Promise(resolve => setTimeout(resolve, 100));
            
            logger.log('🔄 Initial sync: Checking App Group data...');
            logger.log('   - WidgetUpdateModule available:', !!WidgetUpdateModule);
            logger.log('   - WidgetUpdateModule.getAppGroupData available:', !!WidgetUpdateModule?.getAppGroupData);
            
            // WidgetUpdateModule이 사용 가능한지 확인
            if (!WidgetUpdateModule || !WidgetUpdateModule.getAppGroupData) {
              logger.log('⚠️ WidgetUpdateModule not available yet, skipping App Group sync');
              logger.log('   - Will retry after loading local data');
            } else {
              logger.log('✅ WidgetUpdateModule is available, reading App Group data...');
              
              try {
                // App Group에서 FCM 데이터 읽기
                logger.log('📦 Calling WidgetUpdateModule.getAppGroupData("displaySermon")...');
                const appGroupData = await WidgetUpdateModule.getAppGroupData('displaySermon');
                logger.log('✅ getAppGroupData returned:', appGroupData ? `YES (${appGroupData.length} chars)` : 'NO');
                
                if (appGroupData) {
                  logger.log(`📦 App Group data found: ${appGroupData.length} characters`);
                  logger.log(`   - Preview (first 300 chars): ${appGroupData.substring(0, 300)}`);
                  
                  // JSON 파싱해서 content 확인
                  try {
                    const parsedData = JSON.parse(appGroupData);
                    logger.log(`📝 Content length in App Group: ${parsedData.content?.length || 0} characters`);
                    logger.log(`📝 Content preview: ${parsedData.content?.substring(0, 200) || 'N/A'}`);
                    logger.log(`   - Title: ${parsedData.title}`);
                    logger.log(`   - Date: ${parsedData.date}`);
                    logger.log(`   - ID: ${parsedData.id}`);
                  } catch (e) {
                    logger.error('❌ Failed to parse App Group data:', e);
                    logger.error('   - Error details:', e instanceof Error ? e.message : String(e));
                    logger.error('   - Raw data (first 500 chars):', appGroupData.substring(0, 500));
                  }
                  
                  // App Group 데이터를 AsyncStorage로 복사 (앱이 종료된 상태에서 widgetkit push로 받은 데이터)
                  logger.log('📦 Copying App Group data to AsyncStorage (initial sync)...');
                  try {
                    await AsyncStorage.setItem(FCM_SERMON_KEY, appGroupData);
                    logger.log('✅ AsyncStorage.setItem completed');
                    
                    const normalized = normalizeJsonString(appGroupData);
                    logger.log('✅ JSON normalized, length:', normalized.length);
                    
                    updateLastSyncedSignature(normalized);
                    logger.log('✅ Last synced signature updated');
                    logger.log('✅ Successfully synced App Group data to AsyncStorage');
                  } catch (storageError) {
                    logger.error('❌ Failed to save to AsyncStorage:', storageError);
                    logger.error('   - Error details:', storageError instanceof Error ? storageError.message : String(storageError));
                  }
                } else {
                  logger.log('ℹ️ No App Group data found on initial launch');
                }
              } catch (readError) {
                logger.error('❌ Error reading App Group data:', readError);
                logger.error('   - Error details:', readError instanceof Error ? readError.message : String(readError));
                logger.error('   - Error stack:', readError instanceof Error ? readError.stack : 'N/A');
              }
            }
          } catch (error) {
            logger.error('❌ Error syncing app group data on initial launch:', error);
            logger.error('   - Error details:', error instanceof Error ? error.message : String(error));
            logger.error('   - Error stack:', error instanceof Error ? error.stack : 'N/A');
            // 에러가 발생해도 계속 진행 (빈 화면 방지)
          }
        }
        
        // 로컬 데이터 로드 (App Group 데이터가 AsyncStorage로 복사된 후)
        logger.log('📥 Loading local data...');
        try {
          const sermon = await loadLocalData();
          logger.log('✅ Local data loaded:', sermon ? `YES (${sermon.title})` : 'NO');
          
          const latestDate = sermon?.date ? new Date(sermon.date) : null;
          logger.log('📅 Latest date:', latestDate ? latestDate.toISOString() : 'null');
          
          if (checkInvalidate(latestDate)) {
            logger.log('🔄 Data is invalid, fetching from server...');
            await fetchDataFromServer();
            logger.log('✅ Server data fetched');
          } else {
            logger.log('✅ Data is valid, skipping server fetch');
          }
        } catch (loadError) {
          logger.error('❌ Error loading local data:', loadError);
          logger.error('   - Error details:', loadError instanceof Error ? loadError.message : String(loadError));
          logger.error('   - Error stack:', loadError instanceof Error ? loadError.stack : 'N/A');
        }
        
        logger.log('✅ initializeData: App initialization completed');
      } catch (error) {
        logger.error('❌ Critical error in initializeData:', error);
        logger.error('   - Error details:', error instanceof Error ? error.message : String(error));
        logger.error('   - Error stack:', error instanceof Error ? error.stack : 'N/A');
      }
    };

    logger.log('🚀 initializeData: Setting up initialization...');
    initializeData().catch((error) => {
      logger.error('❌ Unhandled error in initializeData:', error);
    });
  }, [loadLocalData, fetchDataFromServer, updateLastSyncedSignature]);


  useEffect(() => {
    const updateWidget = async () => {
      try {
        if (sermon != null) {
          await WidgetUpdateModule.onSermonUpdated(JSON.stringify(sermon));
          logger.log('✅ Widget updated successfully via onSermonUpdated');
        } else {
          logger.log('⚠️ No sermon data to update widget');
        }
      } catch (error) {
        logger.error('Failed to update widgets:', error);
      }
    };

    updateWidget();
  }, [sermon]);

  useEffect(() => {
    // Android와 iOS 모두에서 FCM 이벤트 처리
    const { MyEventModule } = NativeModules;
    
    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }
    
    const eventEmitter = new NativeEventEmitter(MyEventModule);
    
    // 'ON_SERMON_UPDATE' 이벤트를 기다립니다.
    const subscription = eventEmitter.addListener('ON_SERMON_UPDATE', (event) => {
      logger.log(`🎉 ${Platform.OS} Event received!`, event);
      loadLocalData();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 앱이 포그라운드로 돌아올 때 로컬 데이터 확인
  useEffect(() => {
    const syncAppGroupData = async () => {
      // iOS: App Group에서 FCM 데이터를 AsyncStorage로 복사
      if (Platform.OS === 'ios') {
        try {
          logger.log('🔄 Syncing App Group data to AsyncStorage...');
          
          // App Group에서 FCM 데이터 읽기
          const appGroupData = await WidgetUpdateModule.getAppGroupData('displaySermon');
          
          if (appGroupData) {
            logger.log(`📦 App Group data length: ${appGroupData.length} characters`);
            
            // JSON 파싱해서 content 확인
            try {
              const parsedData = JSON.parse(appGroupData);
              logger.log(`📝 Content length in App Group: ${parsedData.content?.length || 0} characters`);
              logger.log(`📝 Content preview: ${parsedData.content?.substring(0, 200) || 'N/A'}`);
            } catch (e) {
              logger.error('Failed to parse App Group data:', e);
            }
            
            // 데이터가 변경되었는지 확인
            const normalized = normalizeJsonString(appGroupData);
            if (normalized !== lastSyncedSignatureRef.current) {
              logger.log('📦 Found new data in App Group, copying to AsyncStorage...');
              // AsyncStorage에 복사
              await AsyncStorage.setItem(FCM_SERMON_KEY, appGroupData);
              updateLastSyncedSignature(normalized);
              logger.log('✅ Successfully synced App Group data to AsyncStorage');
            } else {
              logger.log('ℹ️ App Group data unchanged');
            }
          } else {
            logger.log('ℹ️ No FCM data in App Group');
          }
          
          // 로컬 데이터 로드
          await loadLocalData();
        } catch (error) {
          logger.error('❌ Error syncing app group data:', error);
          await loadLocalData();
        }
      } else {
        await loadLocalData();
      }
    };
    
    // 앱 시작 시 즉시 App Group 데이터 동기화 (AppState가 이미 'active'인 경우)
    const currentAppState = AppState.currentState;
    if (currentAppState === 'active') {
      logger.log('📱 App is already active on mount, syncing App Group data...');
      syncAppGroupData();
    }
    
    // AppState 변경 감지
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        logger.log('📱 App came to foreground, checking for updates...');
        // App Group 데이터 동기화 (WidgetKit Push로 받은 내용)
        // Firestore에서 최신 데이터를 가져오지 않음 - 기존 로컬 데이터(Firestore 캐시, AsyncStorage) 사용
        syncAppGroupData();
      }
    });

    // iOS 포그라운드에서 주기적으로 App Group 체크 (5초마다)
    let intervalId: NodeJS.Timeout | null = null;
    if (Platform.OS === 'ios') {
      intervalId = setInterval(async () => {
        const appState = AppState.currentState;
        if (appState === 'active') {
          try {
            // App Group에서 데이터 읽기
            const appGroupData = await WidgetUpdateModule.getAppGroupData('displaySermon');
            
            // 데이터가 변경되었는지 확인
            if (appGroupData) {
              const normalized = normalizeJsonString(appGroupData);
              if (normalized !== lastSyncedSignatureRef.current) {
                logger.log('⏰ New data detected in App Group, syncing...');
                logger.log('   last signature:', lastSyncedSignatureRef.current?.slice(0, 80));
                logger.log('   new signature  :', normalized.slice(0, 80));
                await AsyncStorage.setItem(FCM_SERMON_KEY, appGroupData);
                updateLastSyncedSignature(normalized);
                await loadLocalData();
              }
            }
          } catch (error) {
            logger.error('Error in periodic check:', error);
          }
        }
      }, 5000); // 5초마다 체크
    }

    return () => {
      subscription?.remove();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loadLocalData, updateLastSyncedSignature]);

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