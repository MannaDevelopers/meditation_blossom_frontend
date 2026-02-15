import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sermon, SermonMetadata } from '../types/Sermon';
import logger from '../utils/logger';

// TempSermonScreen-specific metadata with totalCount
interface TempSermonMetadata extends SermonMetadata {
  totalCount: number;
}

// 스토리지 키
const STORAGE_KEY = 'sermons_data';
const METADATA_KEY = 'sermons_metadata';

function TempSermonScreen(): React.JSX.Element {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TempSermonMetadata>({
    latestDate: '',
    lastUpdated: new Date().toISOString(),
    totalCount: 0
  });

  // 메타데이터 로드
  const loadMetadata = async (): Promise<TempSermonMetadata> => {
    try {
      const metadataStr = await AsyncStorage.getItem(METADATA_KEY);
      if (metadataStr) {
        const parsedMetadata = JSON.parse(metadataStr) as TempSermonMetadata;
        logger.log('Loaded metadata:', parsedMetadata);
        setMetadata(parsedMetadata);
        if (parsedMetadata.latestDate) {
          setLatestDate(parsedMetadata.latestDate);
        }
        return parsedMetadata;
      }
    } catch (error) {
      logger.error('Error loading metadata:', error);
    }
    
    return {
      latestDate: '',
      lastUpdated: new Date().toISOString(),
      totalCount: 0
    };
  };

  // 메타데이터 저장
  const saveMetadata = async (newMetadata: TempSermonMetadata) => {
    try {
      await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(newMetadata));
      setMetadata(newMetadata);
      if (newMetadata.latestDate) {
        setLatestDate(newMetadata.latestDate);
      }
      logger.log('Metadata saved:', newMetadata);
    } catch (error) {
      logger.error('Error saving metadata:', error);
    }
  };

  // 최신 날짜 찾기
  const findLatestDate = (sermonList: Sermon[]): string => {
    if (sermonList.length === 0) return '';
    return [...new Set(sermonList.map(sermon => sermon.date))].sort().reverse()[0];
  };

  // 로컬 데이터 로드
  const loadLocalData = async () => {
    logger.log('Loading local data...');
    try {
      const currentMetadata = await loadMetadata();
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (data) {
        const parsedData = JSON.parse(data) as Sermon[];
        logger.log(`Loaded ${parsedData.length} sermons from local storage`);
        setSermons(parsedData);
        
        // 메타데이터의 최신 날짜 정보가 없으면 계산
        if (!currentMetadata.latestDate && parsedData.length > 0) {
          const newLatestDate = findLatestDate(parsedData);
          
          if (newLatestDate) {
            await saveMetadata({
              ...currentMetadata,
              latestDate: newLatestDate,
              totalCount: parsedData.length
            });
            logger.log(`Calculated and saved latest date: ${newLatestDate}`);
          }
        }
      } else {
        logger.log('No local data found');
      }
      setLoading(false);
    } catch (error) {
      logger.error('Error loading local data:', error);
      setLoading(false);
    }
  };

  // 서버에서 데이터 가져오기
  const fetchDataFromServer = async () => {
    logger.log('Fetching data from server...');
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
        logger.log(`Fetching sermons from date: ${currentMetadata.latestDate}`);
        
        // >= 연산자를 사용해 해당 날짜와 이후의 데이터를 가져옴
        query = sermonsCollection.where('date', '>=', currentMetadata.latestDate);
      }
      
      // 날짜 기준 내림차순 정렬
      query = query.orderBy('date', 'desc');
      
      const snapshot = await query.get();
      logger.log(`Fetched ${snapshot.docs.length} sermons from server`);
      
      if (snapshot.empty) {
        logger.log('No new sermons found');
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
          created_at: firestoreData.created_at || { seconds: 0, nanoseconds: 0 },
          updated_at: firestoreData.updated_at || { seconds: 0, nanoseconds: 0 }
        };
      });
      
      logger.log('Sample of new sermon data:', newSermonsData.length > 0 ? JSON.stringify(newSermonsData[0], null, 2) : 'No data');
      
      // 기존 데이터와 새 데이터를 병합
      const mergedSermons = [...existingSermons];
      
      // ID 중복 확인하여 병합
      newSermonsData.forEach(newSermon => {
        const existingIndex = mergedSermons.findIndex(sermon => sermon.id === newSermon.id);
        if (existingIndex !== -1) {
          // 기존 데이터 업데이트
          mergedSermons[existingIndex] = newSermon;
          logger.log(`Updated existing sermon: ${newSermon.id} for date ${newSermon.date}`);
        } else {
          // 새 데이터 추가
          mergedSermons.push(newSermon);
          logger.log(`Added new sermon: ${newSermon.id} for date ${newSermon.date}`);
        }
      });
      
      logger.log(`Total sermons after merge: ${mergedSermons.length}`);
      
      // AsyncStorage에 저장
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSermons));
      logger.log('Saved merged data to local storage');
      
      setSermons(mergedSermons);
      
      // 가장 최신 날짜 찾기
      const newLatestDate = findLatestDate(mergedSermons);
      if (newLatestDate) {
        logger.log(`New latest date: ${newLatestDate}`);
        
        // 메타데이터 업데이트
        const newMetadata: TempSermonMetadata = {
          latestDate: newLatestDate,
          lastUpdated: new Date().toISOString(),
          totalCount: mergedSermons.length
        };
        
        await saveMetadata(newMetadata);
        logger.log(`Updated metadata with latest date: ${newLatestDate}`);
      }
    } catch (error) {
      logger.error('Error fetching sermons:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 로컬 스토리지 비우기
  const clearLocalStorage = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(METADATA_KEY);
      
      setSermons([]);
      setLatestDate(null);
      setMetadata({
        latestDate: '',
        lastUpdated: new Date().toISOString(),
        totalCount: 0
      });
      
      logger.log('Local storage and metadata cleared');
    } catch (error) {
      logger.error('Error clearing local storage:', error);
    }
  };

  // 로컬 스토리지 내용 확인
  const inspectStorage = async () => {
    logger.log('Inspecting AsyncStorage...');
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      // 모든 키를 로그로 출력
      logger.log(keys);
      
      // 각 키에 대한 데이터 검사
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        logger.log([JSON.parse(value || '{}')]);
      }
    } catch (error) {
      logger.error('Error inspecting AsyncStorage:', JSON.stringify(error, null, 2));
    }
  };

  // 새로고침 핸들러
  const onRefresh = () => {
    setRefreshing(true);
    fetchDataFromServer();
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    // 날짜만 표시
    return date.toLocaleDateString();
  };

  // 타임스탬프 포맷팅
  const formatTimestamp = (timestamp: { seconds: number; nanoseconds: number }): string => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // 최신 날짜의 설교만 표시
  const getLatestSermons = () => {
    if (!latestDate || sermons.length === 0) return [];
    
    // 가장 최근 날짜를 가진 설교만 필터링
    return sermons.filter(sermon => sermon.date === latestDate);
  };

  // 최신 날짜의 설교 목록 계산
  const latestSermons = getLatestSermons();

  // 초기 데이터 로드
  useEffect(() => {
    loadLocalData();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Sermons</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.textButton} 
              onPress={clearLocalStorage}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.textButton} 
              onPress={inspectStorage}
            >
              <Text style={styles.buttonText}>Inspect</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.textButton} 
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Text style={[
                styles.buttonText,
                refreshing && styles.buttonTextDisabled
              ]}>
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {latestDate && (
          <View style={styles.latestDateContainer}>
            <Text style={styles.latestDateText}>
              Latest sermons: {formatDate(latestDate)} ({metadata.totalCount} total)
            </Text>
          </View>
        )}
        
        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : latestSermons.length === 0 ? (
            <Text style={styles.emptyText}>No sermons available</Text>
          ) : (
            latestSermons.map(sermon => (
              <View key={sermon.id} style={styles.sermonItem}>
                <View style={styles.sermonHeader}>
                  <Text style={styles.sermonTitle}>{sermon.title}</Text>
                  <View style={styles.sermonInfo}>
                    {sermon.category && (
                      <Text style={styles.sermonCategory}>{sermon.category}</Text>
                    )}
                    <Text style={styles.sermonDate}>{formatDate(sermon.date)}</Text>
                  </View>
                </View>
                <Text style={styles.sermonContent}>{sermon.content}</Text>
                <View style={styles.sermonFooter}>
                  {sermon.day_of_week && (
                    <Text style={styles.sermonFooterText}>
                      {sermon.day_of_week}
                    </Text>
                  )}
                  <Text style={styles.sermonFooterText}>
                    Updated: {formatTimestamp(sermon.updated_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  textButton: {
    padding: 8,
  },
  buttonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonTextDisabled: {
    opacity: 0.5,
  },
  latestDateContainer: {
    backgroundColor: '#f0f8ff',
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  latestDateText: {
    fontSize: 12,
    color: '#666',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  sermonItem: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sermonHeader: {
    flexDirection: 'column',
    marginBottom: 8,
  },
  sermonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sermonInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sermonCategory: {
    fontSize: 12,
    color: '#1E88E5',
    fontWeight: '500',
  },
  sermonDate: {
    fontSize: 12,
    color: '#666',
  },
  sermonContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  sermonFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  sermonFooterText: {
    fontSize: 10,
    color: '#999',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
});

export default TempSermonScreen;