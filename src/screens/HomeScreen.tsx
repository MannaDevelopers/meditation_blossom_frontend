import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { extractContent } from '../utils/sermonParser';
import SvgIcon from '../components/SvgIcon';
import { BRIDGE_INIT_DELAY_MS } from '../constants';
import { useAppGroupSync } from '../hooks/useAppGroupSync';
import { useFCMListener } from '../hooks/useFCMListener';
import { useSermonData } from '../hooks/useSermonData';
import { useWidgetSync } from '../hooks/useWidgetSync';
import { isSermonDataStale } from '../services/sermonService';
import { logAnalytics } from '../utils/analytics';
import logger from '../utils/logger';
import { processTitleText } from '../utils/textFormatting';

const SUNDAY_SERMON_YOUTUBE_URL = 'https://www.youtube.com/@만나';

const HomeScreen = () => {
  const { sermon, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useSermonData();
  const isInitialMount = useRef(true);

  const sermonContent = useMemo(
    () => (sermon?.content ? extractContent(sermon.content) : { index: '', content: '' }),
    [sermon?.content],
  );

  const { performInitialSync } = useAppGroupSync({
    onDataSynced: loadLocalData,
    enabled: !isLoading,
  });

  useWidgetSync(sermon);
  useFCMListener(loadLocalData);

  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      loadLocalData();
    }, [loadLocalData]),
  );

  const targetYoutubeUrl = sermon?.video_url || SUNDAY_SERMON_YOUTUBE_URL;
  const hasLoggedScroll = useRef(false);

  const openYoutube = () => {
    logAnalytics.youtubeClick('home');
    Linking.openURL(targetYoutubeUrl).catch(e =>
      logger.error('HomeScreen: YouTube 링크 열기 실패', e),
    );
  };

  const handleScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (hasLoggedScroll.current) return;
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 50) {
        hasLoggedScroll.current = true;
        logAnalytics.scrollComplete('home');
      }
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'ios') {
        await new Promise(resolve => setTimeout(resolve, BRIDGE_INIT_DELAY_MS));
        await performInitialSync();
      }
      const loaded = await loadLocalData();
      const latestDate = loaded?.date ? new Date(loaded.date) : null;
      if (isSermonDataStale(latestDate)) {
        logAnalytics.appDataSource('firestore', 'sermon');
        await fetchFromServer();
      } else {
        logAnalytics.appDataSource(loaded ? 'cache' : 'none', 'sermon');
      }
    };
    init().catch((e) => {
      logger.error('HomeScreen init failed:', e);
      setIsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- init must run once on mount; deps are stable callbacks

  if (isLoading && !sermon) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator size="large" color="#A59EAE" />
      </SafeAreaView>
    );
  }

  if (error && !sermon) {
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={400}>
        <View style={styles.seriesCard}>
          <View style={styles.seriesCardText}>
            {sermon?.category ? (
              <Text style={styles.cardTitleText}>{sermon.category}</Text>
            ) : null}
            <Text style={styles.seriesDateText}>{sermon?.date}</Text>
          </View>
          <TouchableOpacity onPress={openYoutube}>
            <SvgIcon name="YoutubeButton" size={60} />
          </TouchableOpacity>
        </View>
        <View style={styles.smallDivider} />
        <Text style={styles.titleText} numberOfLines={0}>
          {processTitleText(sermon?.title)}
        </Text>
        <Text style={styles.indexText}>{sermonContent.index}</Text>
        <View style={styles.contentDivider} />
        <Text style={styles.contentText}>{sermonContent.content}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 27,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  indexText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
  },
  titleText: {
    color: '#747474',
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  contentText: {
    color: '#000000',
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    lineHeight: 24,
    marginBottom: 32,
  },
  seriesCard: {
    backgroundColor: '#F3F4F9',
    borderRadius: 22,
    paddingHorizontal: 25,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  seriesCardText: {
    flex: 1,
    gap: 4,
    marginRight: 12,
  },
  cardTitleText: {
    color: '#747474',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
  },
  seriesDateText: {
    color: '#A59EAE',
    fontSize: 18,
    fontFamily: 'Pretendard-Regular',
  },
  smallDivider: {
    height: 3,
    width: 50,
    backgroundColor: '#8C8C8C',
    marginBottom: 16,
  },
  contentDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
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
