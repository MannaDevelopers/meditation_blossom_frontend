import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import SvgIcon from '../components/SvgIcon';
import { useQtData } from '../hooks/useQtData';
import { useQtFCMListener } from '../hooks/useQtFCMListener';
import { useQtWidgetSync } from '../hooks/useQtWidgetSync';
import { isQtDataStale } from '../services/qtService';
import { logAnalytics } from '../utils/analytics';
import { extractContent } from '../utils/sermonParser';
import logger from '../utils/logger';
import { processTitleText } from '../utils/textFormatting';

const DAILY_MANNA_CHANNEL_URL = encodeURI('https://www.youtube.com/@만나');

const DailyMannaScreen = () => {
  const { qt, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useQtData();
  const isInitialMount = useRef(true);

  useQtWidgetSync(qt);
  useQtFCMListener(loadLocalData);

  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      loadLocalData();
    }, [loadLocalData]),
  );

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
        // Firestore 경로: JSON.stringify(array) → JSON.parse → array
        return parsed
          .flatMap((q: unknown) => typeof q === 'string' ? q.split('\n') : [])
          .filter((q: string) => q.trim());
      }
      if (typeof parsed === 'string') {
        // Firestore 경로: JSON.stringify(plainString) → JSON.parse → string
        return parsed.split('\n').filter((q: string) => q.trim());
      }
      return [];
    } catch {
      // FCM/App Group 경로: 평문 한국어 문자열로 저장된 경우
      const raw = qt.meditation_questions;
      if (typeof raw === 'string') {
        return raw.split('\n').filter((q: string) => q.trim());
      }
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

  // Fabric(New Architecture) 초기 렌더 버그 워크어라운드 (HomeScreen과 동일):
  // SPINNER/ERROR→CONTENT 분기 교체(reconciliation)를 없애고 항상 같은 컴포넌트 트리를 렌더한다.
  // 위젯 딥링크로 매일 만나 탭에 곧바로 진입(콜드 스타트)하면 분기 교체 트리가
  // 첫 커밋되지 않아 탭 전환 전까지 빈 화면이 되는 문제를 방지한다.
  // 로딩/에러 상태는 absoluteFill overlay로 표시한다.
  const showSpinner = isLoading && !qt;
  const showError = error && !qt;
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={400}>
        {/* 카드(시리즈/날짜/유튜브 아이콘) 전체를 유튜브 바로가기 터치 영역으로 확장.
            cancelable={false}로 스크롤/스와이프 제스처가 터치를 탈취하지 못하게 하고,
            SVG는 pointerEvents="none"으로 터치를 부모 Pressable에 통과시킨다. */}
        <Pressable
          style={styles.seriesCard}
          onPress={openYoutube}
          cancelable={false}
        >
          <View style={styles.seriesCardText}>
            {qt?.series_title ? (
              <Text style={styles.seriesTitleText}>{qt.series_title}</Text>
            ) : null}
            <Text style={styles.dateText}>{qt?.date}</Text>
          </View>
          <SvgIcon name="YoutubeButton" size={60} pointerEvents="none" />
        </Pressable>
        <View style={styles.smallDivider} />
        <Text selectable style={styles.titleText} numberOfLines={0}>
          {processTitleText(qt?.title)}
        </Text>
        {qtContent.index ? (
          <Text selectable style={styles.indexText}>{qtContent.index}</Text>
        ) : null}
        <View style={styles.contentDivider} />
        {qtContent.content ? (
          <Text selectable style={styles.contentText}>{qtContent.content}</Text>
        ) : (
          <Text selectable style={styles.contentUnavailableText}>
            오늘 말씀은 책을 참고해주세요
          </Text>
        )}
        {isSunday ? (
          <Text selectable style={styles.noQuestionText}>오늘은 묵상 질문이 없습니다</Text>
        ) : meditationQuestions.length > 0 ? (
          <View style={styles.questionsContainer}>
            <Text selectable style={styles.questionsSectionTitle}>묵상 질문</Text>
            {meditationQuestions.map((question, index) => (
              <View key={index} style={styles.questionCard}>
                <Text selectable style={styles.questionNumber}>
                  {index === 0 ? '•' : ''}
                </Text>
                <Text selectable style={styles.questionText}>{question}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      {showSpinner && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#A59EAE" />
        </View>
      )}
      {showError && (
        <View style={styles.loadingOverlay}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  contentUnavailableText: {
    color: '#A59EAE',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 32,
    fontStyle: 'italic',
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
    color: '#49454F',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 24,
  },
  questionText: {
    flex: 1,
    color: '#49454F',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
