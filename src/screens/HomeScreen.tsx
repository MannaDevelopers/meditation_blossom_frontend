import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WidgetPreview from '../components/WidgetPreview';
import SvgIcon from '../components/SvgIcon';
import { BRIDGE_INIT_DELAY_MS } from '../constants';
import { useAppGroupSync } from '../hooks/useAppGroupSync';
import { useFCMListener } from '../hooks/useFCMListener';
import { useSermonData } from '../hooks/useSermonData';
import { useWidgetSync } from '../hooks/useWidgetSync';
import { isSermonDataStale } from '../services/sermonService';
import { RootStackParamList } from '../types/navigation';
import { processTitleText } from '../utils/textFormatting';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeScreen'>;

const HomeScreen = ({ navigation }: Props) => {
  const { sermon, isLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useSermonData();

  const onDataSynced = useCallback(async () => {
    await loadLocalData();
  }, [loadLocalData]);

  const { performInitialSync } = useAppGroupSync({
    onDataSynced,
    enabled: !isLoading,
  });

  useWidgetSync(sermon);
  useFCMListener(useCallback(() => { loadLocalData(); }, [loadLocalData]));

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'ios') {
        await new Promise(resolve => setTimeout(resolve, BRIDGE_INIT_DELAY_MS));
        await performInitialSync();
      }
      const loaded = await loadLocalData();
      const latestDate = loaded?.date ? new Date(loaded.date) : null;
      if (isSermonDataStale(latestDate)) {
        await fetchFromServer();
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading && !sermon) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#A59EAE" />
      </SafeAreaView>
    );
  }

  if (error && !sermon) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../assets/image/20250416_meditation_icon.png')}
            style={styles.icon}
          />
          <Text style={styles.appTitle}>묵상만개</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('SettingsScreen', { onRefresh })}
            style={styles.settingsButton}
          >
            <SvgIcon name="SettingButton" size={20} color="black" />
          </TouchableOpacity>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{sermon?.date}</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText} numberOfLines={0}>
            {processTitleText(sermon?.title)}
          </Text>
        </View>
        <View style={styles.previewContainer}>
          <WidgetPreview content={sermon?.content} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 35,
    marginVertical: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    width: 305,
    height: 30,
    marginBottom: 35,
    alignItems: 'center',
  },
  icon: {
    backgroundColor: 'transparent',
    borderRadius: 15,
    width: 20,
    height: 20,
  },
  appTitle: {
    color: '#49454F',
    fontSize: 20,
    fontFamily: 'Pretendard-Medium',
    marginLeft: 8,
  },
  settingsButton: {
    marginLeft: 'auto',
  },
  dateContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    width: 305,
    height: 25,
  },
  dateText: {
    color: '#A59EAE',
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
  },
  titleContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    width: 305,
    minHeight: 30,
    paddingVertical: 5,
  },
  titleText: {
    color: '#A59EAE',
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  previewContainer: {
    backgroundColor: 'transparent',
    width: 305,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 16,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#A59EAE',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Bold',
  },
});

export default HomeScreen;
