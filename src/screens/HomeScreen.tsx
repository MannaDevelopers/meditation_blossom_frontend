import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, NativeEventEmitter, NativeModules, Platform, Text, TouchableOpacity, View } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocsFromCache, getDocsFromServer, getFirestore, limit, orderBy, query } from '@react-native-firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { RootStackParamList } from '../types/navigation';
import { compareSermon, FCM_SERMON_KEY, fcmDataToSermon, firestoreDocToSermon, Sermon } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';


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
    console.error('Failed to normalize JSON string:', error);
    return '';
  }
};

const HomeScreen = ({ navigation }: Props) => {
  console.log('🚀 HomeScreen component rendering');
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [lastSyncedSignature, setLastSyncedSignature] = useState<string | null>(null);
  const lastSyncedSignatureRef = React.useRef<string | null>(null);

  const updateLastSyncedSignature = useCallback((signature: string | null) => {
    setLastSyncedSignature(signature);
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
      console.error('failed to load latest sermon from firestore', error);
      return null;
    }
  }

  const latestSermonFromAsyncStorage = async (): Promise<Sermon | null> => {
    try {
      const latestSermon = await AsyncStorage.getItem(FCM_SERMON_KEY);
      if (latestSermon) {
        const rawData = JSON.parse(latestSermon);
        return fcmDataToSermon(rawData);
      }
    } catch (error) {
      console.error('failed to load latest sermon from async storage', error);
      return null;
    }
    return null;
  }

  // 로컬 데이터 로드
  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    console.log('📥 Loading local data...');

    const firestoreCache: Sermon | null = await latestSermonFromFirestoreCache();
    const asyncStorageCache: Sermon | null = await latestSermonFromAsyncStorage();
    
    // 데이터 출력
    console.log('📊 Data sources:');
    console.log('  - Firestore cache:', firestoreCache ? `${firestoreCache.title} (${firestoreCache.date})` : 'null');
    console.log('  - AsyncStorage:', asyncStorageCache ? `${asyncStorageCache.title} (${asyncStorageCache.date})` : 'null');

    if (firestoreCache == null && asyncStorageCache == null) {
      console.log('❌ No local data found');
      setSermon(null);
      return null;
    }

    // 2개 데이터 중 가장 최신 선택
    const compareResult = compareSermon(firestoreCache, asyncStorageCache);
    console.log(`🔍 Compare result (firestoreCache vs asyncStorageCache): ${compareResult}`);
    
    let selectedSermon: Sermon | null = null;

    if (compareResult >= 0) {
      selectedSermon = firestoreCache;
      console.log('✅ Selected Firestore cache');
    } else {
      selectedSermon = asyncStorageCache;
      console.log('✅ Selected AsyncStorage');
    }
    
    // content 확인
    if (selectedSermon) {
      console.log(`📝 Content length: ${selectedSermon.content?.length || 0} characters`);
      console.log(`📝 Content preview (first 200 chars): ${selectedSermon.content?.substring(0, 200) || 'N/A'}`);
    }
    
    setSermon(selectedSermon);
    console.log(`📌 Final selected sermon: ${selectedSermon?.title} (${selectedSermon?.date})`);
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

      const latestDoc = snapshot.docs[0];
      console.log('🔥 Latest sermon from Firestore (raw doc data):', latestDoc.data());
      console.log('🔥 Firestore doc id:', latestDoc.id);

      const latestSermon = firestoreDocToSermon(latestDoc);
      console.log('🔥 Converted Firestore sermon:', latestSermon);
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
          console.log('✅ Widget updated successfully via onSermonUpdated');
        } else {
          console.log('⚠️ No sermon data to update widget');
        }
      } catch (error) {
        console.error('Failed to update widgets:', error);
      }
    };

    updateWidget();
  }, [sermon]);

  useEffect(() => {
    // Android와 iOS 모두에서 FCM 이벤트 처리
    const { MyEventModule } = NativeModules;
    
    if (!MyEventModule) {
      console.log('MyEventModule not available');
      return;
    }
    
    const eventEmitter = new NativeEventEmitter(MyEventModule);
    
    // 'ON_SERMON_UPDATE' 이벤트를 기다립니다.
    const subscription = eventEmitter.addListener('ON_SERMON_UPDATE', (event) => {
      console.log(`🎉 ${Platform.OS} Event received!`, event);
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
          console.log('🔄 Syncing App Group data to AsyncStorage...');
          
          // App Group에서 FCM 데이터 읽기
          const appGroupData = await WidgetUpdateModule.getAppGroupData('displaySermon');
          
          if (appGroupData) {
            console.log(`📦 App Group data length: ${appGroupData.length} characters`);
            
            // JSON 파싱해서 content 확인
            try {
              const parsedData = JSON.parse(appGroupData);
              console.log(`📝 Content length in App Group: ${parsedData.content?.length || 0} characters`);
              console.log(`📝 Content preview: ${parsedData.content?.substring(0, 200) || 'N/A'}`);
            } catch (e) {
              console.error('Failed to parse App Group data:', e);
            }
            
            // 데이터가 변경되었는지 확인
            const normalized = normalizeJsonString(appGroupData);
            if (normalized !== lastSyncedSignature) {
              console.log('📦 Found new data in App Group, copying to AsyncStorage...');
              // AsyncStorage에 복사
              await AsyncStorage.setItem(FCM_SERMON_KEY, appGroupData);
              updateLastSyncedSignature(normalized);
              console.log('✅ Successfully synced App Group data to AsyncStorage');
            } else {
              console.log('ℹ️ App Group data unchanged');
            }
          } else {
            console.log('ℹ️ No FCM data in App Group');
          }
          
          // 로컬 데이터 로드
          await loadLocalData();
        } catch (error) {
          console.error('❌ Error syncing app group data:', error);
          await loadLocalData();
        }
      } else {
        await loadLocalData();
      }
    };
    
    // AppState 변경 감지
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground, checking for updates...');
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
                console.log('⏰ New data detected in App Group, syncing...');
                console.log('   last signature:', lastSyncedSignatureRef.current?.slice(0, 80));
                console.log('   new signature  :', normalized.slice(0, 80));
                await AsyncStorage.setItem(FCM_SERMON_KEY, appGroupData);
                updateLastSyncedSignature(normalized);
                await loadLocalData();
              }
            }
          } catch (error) {
            console.error('Error in periodic check:', error);
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