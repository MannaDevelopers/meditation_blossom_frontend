import {View, Text, TouchableOpacity} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sermon, SermonMetadata, STORAGE_KEY, METADATA_KEY } from '../types/Sermon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsScreen'>;

const SettingsScreen = ({navigation, route}: Props) => {
  // 로컬 스토리지 비우기
  const clearLocalStorage = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(METADATA_KEY);

      route.params.setSermons([]);
      route.params.setLatestDate(null);
      route.params.setMetadata({
        latestDate: '',
        lastUpdated: new Date().toISOString(),
        totalCount: 0
      });
      
      console.log('Local storage and metadata cleared');
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black', marginHorizontal: 35, marginVertical: 60, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Settings Screen</Text>
      <TouchableOpacity onPress={clearLocalStorage} style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5, marginTop: 20 }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20, textAlign: 'center' }}>Clear Local Storage</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={route.params.onRefresh} style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5, marginTop: 20 }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20, textAlign: 'center' }}>Refresh Data</Text>
      </TouchableOpacity>
    </View>
  );
}   

export default SettingsScreen;