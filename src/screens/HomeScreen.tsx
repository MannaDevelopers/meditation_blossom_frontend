import React, { use, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Button, TouchableOpacity, ImageBackground, Platform } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import Icon from 'react-native-vector-icons/AntDesign';
import { RootStackParamList } from '../types/navigation';
import { Sermon, SermonMetadata, STORAGE_KEY, METADATA_KEY, DISPLAY_SERMON_KEY } from '../types/Sermon';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Preference from 'react-native-default-preference';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import {SafeAreaView} from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';


type Props = NativeStackScreenProps<RootStackParamList, 'HomeScreen'>;

const HomeScreen = ({navigation}: Props) => {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SermonMetadata>({
    latestDate: '',
    lastUpdated: new Date().toISOString(),
    totalCount: 0
  });
  const [displaySermon, setDisplaySermon] = useState<Sermon | undefined>(undefined);

  // 메타데이터 로드
  const loadMetadata = async (): Promise<SermonMetadata> => {
    try {
      const metadataStr = await AsyncStorage.getItem(METADATA_KEY);
      if (metadataStr) {
        const parsedMetadata = JSON.parse(metadataStr) as SermonMetadata;
        console.log('Loaded metadata:', parsedMetadata);
        setMetadata(parsedMetadata);
        if (parsedMetadata.latestDate) {
          setLatestDate(parsedMetadata.latestDate);
        }
        return parsedMetadata;
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
    
    return {
      latestDate: '',
      lastUpdated: new Date().toISOString(),
      totalCount: 0
    };
  };

  // 메타데이터 저장
  const saveMetadata = async (newMetadata: SermonMetadata) => {
    try {
      await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(newMetadata));
      setMetadata(newMetadata);
      if (newMetadata.latestDate) {
        setLatestDate(newMetadata.latestDate);
      }
      console.log('Metadata saved:', newMetadata);
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  };

  // 최신 날짜 찾기
  const findLatestSermon = (sermonList: Sermon[]): Sermon | null => {
    if (sermonList.length === 0) return null;
    // created_at 기준 내림차순 정렬 후 첫 번째 sermon의 date 반환
    const latestSermon = [...sermonList].sort((a, b) => b.created_at.seconds - a.created_at.seconds)[0];
    console.log('Latest sermon:', latestSermon);
    return latestSermon;
  };

  // 로컬 데이터 로드
  const loadLocalData = async () => {
    console.log('Loading local data...');
    try {
      const currentMetadata = await loadMetadata();
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (data) {
        const parsedData = JSON.parse(data) as Sermon[];
        console.log(`Loaded ${parsedData.length} sermons from local storage`);
        setSermons(parsedData);
        
        // 메타데이터의 최신 날짜 정보가 없으면 계산
        if (!currentMetadata.latestDate && parsedData.length > 0) {
          const newLatestDate = findLatestSermon(parsedData)?.date;
          
          if (newLatestDate) {
            await saveMetadata({
              ...currentMetadata,
              latestDate: newLatestDate,
              totalCount: parsedData.length
            });
            console.log(`Calculated and saved latest date: ${newLatestDate}`);
          }
        }
      } else {
        console.log('No local data found');
        // 로컬 데이터가 없으면 서버에서 데이터 가져오기
        await fetchDataFromServer();
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading local data:', error);
      setLoading(false);
    }
  };
  // 서버에서 데이터 가져오기
  const fetchDataFromServer = async () => {
    console.log('Fetching data from server...');
    try {
      let existingSermons: Sermon[] = [];
      let currentMetadata = metadata;
      
      // 메타데이터가 없으면 다시 로드
      if (!currentMetadata.latestDate) {
        currentMetadata = await loadMetadata();
      }
      
      const localData = await AsyncStorage.getItem(STORAGE_KEY);
      if (localData) {
        existingSermons = JSON.parse(localData) as Sermon[];
      }
      
      // Firestore 쿼리 준비
      const sermonsCollection = firestore().collection('sermons');
      let query: any = sermonsCollection;
      
      // 최신 날짜 기준으로 쿼리 설정
      if (currentMetadata.latestDate) {
        console.log(`Fetching sermons from date: ${currentMetadata.latestDate}`);
        
        // >= 연산자를 사용해 해당 날짜와 이후의 데이터를 가져옴
        query = sermonsCollection.where('date', '>=', currentMetadata.latestDate);
      }
      
      // 날짜 기준 내림차순 정렬
      query = query.orderBy('date', 'desc');
      
      const snapshot = await query.get();
      console.log(`Fetched ${snapshot.docs.length} sermons from server`);
      
      if (snapshot.empty) {
        console.log('No new sermons found');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // 새로운 설교 데이터 처리
      const newSermonsData: Sermon[] = snapshot.docs.map((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
        const firestoreData = doc.data();
        
        return {
          id: doc.id,
          title: firestoreData.title || '',
          content: firestoreData.content || '',
          date: firestoreData.date || new Date().toISOString().split('T')[0],
          category: firestoreData.category || '',
          day_of_week: firestoreData.day_of_week || '',
          created_at: firestoreData.created_at || 0,
          updated_at: firestoreData.updated_at || 0
        };
      });
      
      console.log('Sample of new sermon data:', newSermonsData.length > 0 ? JSON.stringify(newSermonsData[0], null, 2) : 'No data');
      
      // 기존 데이터와 새 데이터를 병합
      const mergedSermons = [...existingSermons];
      
      // ID 중복 확인하여 병합
      newSermonsData.forEach(newSermon => {
        const existingIndex = mergedSermons.findIndex(sermon => sermon.id === newSermon.id);
        if (existingIndex !== -1) {
          // 기존 데이터 업데이트
          mergedSermons[existingIndex] = newSermon;
          console.log(`Updated existing sermon: ${newSermon.id} for date ${newSermon.date}`);
        } else {
          // 새 데이터 추가
          mergedSermons.push(newSermon);
          console.log(`Added new sermon: ${newSermon.id} for date ${newSermon.date}`);
        }
      });
      
      console.log(`Total sermons after merge: ${mergedSermons.length}`);
      
      // AsyncStorage에 저장
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSermons));
      console.log('Saved merged data to local storage');
      
      // 가장 최신 날짜 찾기
      const latestSermon = findLatestSermon(mergedSermons);
      console.log('Latest sermon:', latestSermon);
      const newLatestDate = latestSermon?.date;
      if (newLatestDate) {
        console.log(`New latest date: ${newLatestDate}`);
        
        // 메타데이터 업데이트
        const newMetadata: SermonMetadata = {
          latestDate: newLatestDate,
          lastUpdated: new Date().toISOString(),
          totalCount: mergedSermons.length
        };
        
        await saveMetadata(newMetadata);
        console.log(`Updated metadata with latest date: ${newLatestDate}`);
        
        // 화면에 표시할 설교는 따로 저장 (가장 최신 설교)
        setDisplaySermon(latestSermon);
        await AsyncStorage.setItem(DISPLAY_SERMON_KEY, JSON.stringify(latestSermon));        
        console.log('Display sermon saved:', latestSermon);
        
        // 위젯 업데이트
        try {
          await WidgetUpdateModule.onSermonUpdated(JSON.stringify(latestSermon));
          console.log('Sermon data saved');
        } catch (error) {
          console.error('Failed to update widgets:', error);
        }
        setSermons([...mergedSermons]);
      }
    } catch (error) {
      console.error('Error fetching sermons:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 새로고침 핸들러
  const onRefresh = () => {
    setRefreshing(true);
    fetchDataFromServer();
  };


  // 제목 텍스트 처리 - 소괄호 부분을 줄바꿈
  const processTitleText = (title: string | undefined): string => {
    if (!title) return '';
    
    // 소괄호를 찾아서 줄바꿈 추가
    return title.replace(/\(/g, '\n(').replace(/\)/g, ')');
  };

  
  // 1주일 마다 자동으로 서버에서 데이터 요청
  const AutoRequest = () =>
  {
    if(latestDate == null)
      return false;

    // 현재 날짜와 최신 날짜를 비교
    const currentDate = new Date(); 
    const latestSermonDate = new Date(latestDate);
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(currentDate.getDate() - 7);

    console.log('Current Date:', currentDate.toISOString());
    console.log('Latest Sermon Date:', latestSermonDate.toISOString());

    // 최신 날짜가 1주일 전보다 이전이면 서버에서 데이터 요청
    if (latestSermonDate <= oneWeekAgo) {
      console.log('Fetching data from server due to outdated latest date');
      onRefresh();
    }
    return true;
  }
  
  // 초기 데이터 로드
  useEffect(() => {
    loadLocalData();
  }, []);

  useEffect(() => {
    AutoRequest();
  }
  , [latestDate]);


  useEffect(() => {
    // 설교가 변경되면 보여줄 설교를 업데이트
    // console.log('sermons changed:', sermons);
    setDisplaySermon(findLatestSermon(sermons) || undefined);    
  }, [sermons])
  
  // ios AppGroup으로 위젯에 전시될 말씀만 전달
  if (Platform.OS === 'ios') {
    Preference.setName('group.com.Blossom.MeditationBlossom');
    Preference.clear('displaySermon').then(() => {
      console.log('데이터 초기화')
    });
    Preference.set('displaySermon', JSON.stringify(displaySermon)).then(() => {
      console.log('데이터 저장 성공, ', JSON.stringify(displaySermon));
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent', marginHorizontal: 35, marginVertical: 35, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'transparent', flex: 1 }}>
        <View style={{ backgroundColor: 'transparent', flexDirection: 'row', width: 305, height: 30, marginBottom: 35, alignItems: 'center'}}>
          <Image source={require('../assets/image/20250416_meditation_icon.png')} style={{ backgroundColor: 'transparent', borderRadius: 15, width: 20, height: 20 }} />
          <Text style={{ color: '#49454F', fontSize: 20, fontFamily: "Pretendard-Medium", marginLeft: 8}}>묵상만개</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SettingsScreen', { setSermons, setLatestDate, setMetadata, setDisplaySermon, onRefresh })} style={{ marginLeft: 'auto'}}>
            <SvgIcon name="SettingButton" size={20} color='black'/>
          </TouchableOpacity>
        </View>
        <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, height: 25 }}>
          <Text style={{ color: "#A59EAE", fontSize: 20, fontFamily: "Pretendard-SemiBold" }}>{displaySermon?.date}</Text>
        </View>
        <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, minHeight: 30, paddingVertical: 5 }}>
          <Text style={{ color: "#A59EAE", fontSize: 24, fontFamily: "Pretendard-Bold", textAlign: 'center', flexWrap: 'wrap' }} numberOfLines={0}>{processTitleText(displaySermon?.title)}</Text>
        </View>
        <View style={{ backgroundColor: 'transparent', width: 305, height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <WidgetPreview content={displaySermon?.content} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default HomeScreen