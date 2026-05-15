import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { logAnalytics } from '../utils/analytics';
import { extractContent } from '../utils/sermonParser';
import logger from '../utils/logger';
import { processTitleText } from '../utils/textFormatting';

const DAILY_MANNA_CHANNEL_URL = 'https://www.youtube.com/@만나';

const DailyMannaScreen = () => {
  const { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useQtData();

  useQtWidgetSync(qt);
  useQtFCMListener(loadLocalData);

  const qtContent = useMemo(
    () => (qt?.content ? extractContent(qt.content) : { index: '', content: '' }),
    [qt?.content],
  );

  const isSunday = qt?.day_of_week === 'SUN';

  const meditationQuestions = useMemo(() => {
    if (!qt?.meditation_questions) return [];
    try {
      const parsed = JSON.parse(qt.meditation_questions);
      if (Array.isArray(parsed)) {
        // 각 요소를 \n으로 쪼개서 flat하게 만들기
        return parsed
          .flatMap((q: string) => q.split('\n'))
          .filter((q: string) => q.trim());
      }
      return [];
    } catch (e) {
      logger.error('DailyMannaScreen: meditation_questions 파싱 실패', e instanceof Error ? e.message : String(e));
      return [];
    }
  }, [qt?.meditation_questions]);

  const targetYoutubeUrl = qt?.video_url || DAILY_MANNA_CHANNEL_URL;
  const hasLoggedScroll = useRef(false);

  const openYoutube = () => {
    logAnalytics.youtubeClick('daily_manna');
    Linking.openURL(targetYoutubeUrl).catch((e) =>
      logger.error('DailyMannaScreen: YouTube 링크 열기 실패', e),
    );
  };

  const handleScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (hasLoggedScroll.current) return;
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 50) {
        hasLoggedScroll.current = true;
        logAnalytics.scrollComplete('daily_manna');
      }
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
      const loaded = await loadLocalData();
      const latestDate = loaded?.date ? new Date(loaded.date) : null;
      if (isQtDataStale(latestDate)) {
        logAnalytics.appDataSource('firestore', 'qt');
        await fetchFromServer();
      } else {
        logAnalytics.appDataSource(loaded ? 'cache' : 'none', 'qt');
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={400}>
        <View style={styles.seriesCard}>
          <View style={styles.seriesCardText}>
            {qt?.series_title ? (
              <Text style={styles.seriesTitleText}>{qt.series_title}</Text>
            ) : null}
            <Text style={styles.dateText}>{qt?.date}</Text>
          </View>
          <TouchableOpacity onPress={openYoutube}>
            <SvgIcon name="YoutubeButton" size={60} />
          </TouchableOpacity>
        </View>
        <View style={styles.smallDivider} />
        <Text style={styles.titleText} numberOfLines={0}>
          {processTitleText(qt?.title)}
        </Text>
        <Text style={styles.indexText}>{qtContent.index}</Text>
        <View style={styles.contentDivider} />
        <Text style={styles.contentText}>{qtContent.content}</Text>
        {isSunday ? (
          <Text style={styles.noQuestionText}>오늘은 묵상 질문이 없습니다</Text>
        ) : meditationQuestions.length > 0 ? (
          <View style={styles.questionsContainer}>
            <Text style={styles.questionsSectionTitle}>묵상 질문</Text>
            {meditationQuestions.map((question, index) => (
              <View key={index} style={styles.questionCard}>
                <Text style={styles.questionNumber}>
                  {index === 0 ? '•' : ''}
                </Text>
                <Text style={styles.questionText}>{question}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  dateText: {
    color: '#A59EAE',
    fontSize: 18,
    fontFamily: 'Pretendard-Regular',
  },
  seriesCard: {
    backgroundColor: '#F3F4F9',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  seriesCardText: {
    flex: 1,
    gap: 4,
  },
  seriesTitleText: {
    color: '#747474',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
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
  questionsSectionTitle: {
    color: '#747474',
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 12,
  },
  titleText: {
    color: '#747474',
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  indexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  indexText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
  },
  contentText: {
    color: '#000000',
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    lineHeight: 24,
    marginBottom: 32,
  },
noQuestionText: {
    color: '#A59EAE',
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 32,
  },
  questionsContainer: {
    backgroundColor: '#EBFAFF',
    borderRadius: 15,
    padding: 20,
    gap: 12,
    marginBottom: 32,
  },
  questionCard: {
    flexDirection: 'row',
    gap: 8,
  },
  questionNumber: {
    color: '#A59EAE',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 24,
  },
  questionText: {
    flex: 1,
    color: '#A59EAE',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 24,
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
