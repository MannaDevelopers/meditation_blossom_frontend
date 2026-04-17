import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { useQtData } from '../hooks/useQtData';
import { useQtFCMListener } from '../hooks/useQtFCMListener';
import { useQtWidgetSync } from '../hooks/useQtWidgetSync';
import { isQtDataStale } from '../services/qtService';
import { RootStackParamList } from '../types/navigation';
import { extractContent } from '../utils/sermonParser';
import logger from '../utils/logger';
import { processTitleText } from '../utils/textFormatting';

const DAILY_MANNA_CHANNEL_URL = 'https://www.youtube.com/@mannachurch';

const DailyMannaScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useQtData();

  useQtWidgetSync(qt);
  useQtFCMListener(loadLocalData);

  const qtContent = useMemo(
    () => (qt?.content ? extractContent(qt.content) : { index: '', content: '' }),
    [qt?.content],
  );

  const targetYoutubeUrl = qt?.video_url || DAILY_MANNA_CHANNEL_URL;

  const openYoutube = () => {
    Linking.openURL(targetYoutubeUrl).catch((e) =>
      logger.error('DailyMannaScreen: YouTube 링크 열기 실패', e),
    );
  };

  useEffect(() => {
    const init = async () => {
      const loaded = await loadLocalData();
      const latestDate = loaded?.date ? new Date(loaded.date) : null;
      if (isQtDataStale(latestDate)) {
        await fetchFromServer();
      }
    };
    init().catch((e) => {
      logger.error('DailyMannaScreen init failed:', e);
      setIsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading && !qt) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator size="large" color="#A59EAE" />
      </SafeAreaView>
    );
  }

  if (error && !qt) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Image
          source={require('../assets/image/20250416_meditation_icon.png')}
          style={styles.icon}
        />
        <Text style={styles.appTitle}>묵상만개</Text>
        <TouchableOpacity onPress={openYoutube} style={styles.youtubeButton}>
          <SvgIcon name="YoutubeButton" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('SettingsScreen', { onRefresh })}
          style={styles.settingsButton}
        >
          <SvgIcon name="SettingButton" size={20} color="black" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.dateText}>{qt?.date}</Text>
        {qt?.series_title ? (
          <Text style={styles.seriesTitleText}>{qt.series_title}</Text>
        ) : null}
        <Text style={styles.titleText} numberOfLines={0}>
          {processTitleText(qt?.title)}
        </Text>
        <Text style={styles.indexText}>{qtContent.index}</Text>
        <Text style={styles.contentText}>{qtContent.content}</Text>
        <TouchableOpacity style={styles.youtubeLinkContainer} onPress={openYoutube}>
          <SvgIcon name="YoutubeButton" size={20} />
          <Text style={styles.youtubeLinkText}>YouTube 영상 바로가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 35,
    marginTop: 35,
  },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    height: 30,
    marginBottom: 20,
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
  youtubeButton: { marginLeft: 'auto', padding: 2 },
  settingsButton: { marginLeft: 8 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  dateText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  seriesTitleText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 4,
  },
  titleText: {
    color: '#A59EAE',
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  indexText: {
    color: '#49454F',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  contentText: {
    color: '#49454F',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 26,
    marginBottom: 32,
  },
  youtubeLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youtubeLinkText: {
    color: '#A59EAE',
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  errorContainer: { justifyContent: 'center', alignItems: 'center' },
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

export default DailyMannaScreen;
