import {View, Text, TouchableOpacity} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sermon, SermonMetadata, STORAGE_KEY, METADATA_KEY } from '../types/Sermon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import SvgIcon from '../components/SvgIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsScreen'>;

const SettingsScreen = ({navigation, route}: Props) => {
  // 로컬 스토리지 비우기
  const clearLocalStorage = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(METADATA_KEY);
      await AsyncStorage.removeItem('dispaly_sermon');

      route.params.setSermons([]);
      route.params.setLatestDate(null);
      route.params.setMetadata({
        latestDate: '',
        lastUpdated: new Date().toISOString(),
        totalCount: 0
      });
      route.params.setDisplaySermon(undefined);
      
      console.log('Local storage and metadata cleared');
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  };

  // 로컬 스토리지 내용 확인
  const inspectStorage = async () => {
    console.log('Inspecting AsyncStorage...');
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      // 모든 키를 로그로 출력
      console.log(keys);
      
      // 각 키에 대한 데이터 검사
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        console.log([JSON.parse(value || '{}')]);
      }
    } catch (error) {
      console.error('Error inspecting AsyncStorage:', JSON.stringify(error, null, 2));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {/* 헤더 영역 */}
    <View style={{ backgroundColor: 'transparent', width: '100%', height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 30 }}>
      {/* 뒤로가기 버튼 */}
      <TouchableOpacity onPress={() => {navigation.goBack();}}><SvgIcon name="BackButton" size={20} /></TouchableOpacity>
    </View>
    <View style={{ flex: 1, backgroundColor: 'black', marginHorizontal: 35, marginVertical: 60, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Settings Screen</Text>
      <TouchableOpacity onPress={clearLocalStorage} style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5, marginTop: 20 }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20, textAlign: 'center' }}>Clear Local Storage</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={route.params.onRefresh} style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5, marginTop: 20 }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20, textAlign: 'center' }}>Refresh Data</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={inspectStorage} style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5, marginTop: 20 }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20, textAlign: 'center' }}>Inspect Storage</Text>
      </TouchableOpacity>
    </View>
    </View>
  );
}   

export default SettingsScreen;