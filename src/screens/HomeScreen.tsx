import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { extractContent } from '../utils/sermonParser';
import MeditationNoteSheet from '../components/MeditationNoteSheet';
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
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemeColors } from '../theme/colors';

const SUNDAY_SERMON_YOUTUBE_URL = encodeURI('https://www.youtube.com/@만나');

const HomeScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { sermon, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh } =
    useSermonData();

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
      logger.log('[Home] useFocusEffect: focus → loadLocalData');
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
      logger.log('[Home] init: start');
      // AsyncStorage 읽기는 네이티브 브릿지 불필요 → 지연 없이 즉시 실행
      const loaded = await loadLocalData();
      logger.log('[Home] init: loadLocalData done, loaded=' + (loaded?.date ?? 'null'));

      if (Platform.OS === 'ios') {
        // 브릿지 초기화 대기 후 App Group 동기화 (네이티브 모듈 필요)
        await new Promise(resolve => setTimeout(resolve, BRIDGE_INIT_DELAY_MS));
        await performInitialSync();
        logger.log('[Home] init: performInitialSync done');
      }

      const latestDate = loaded?.date ? new Date(loaded.date) : null;
      if (isSermonDataStale(latestDate)) {
        logAnalytics.appDataSource('firestore', 'sermon');
        logger.log('[Home] init: data stale → fetchFromServer');
        await fetchFromServer();
        logger.log('[Home] init: fetchFromServer done');
      } else {
        logAnalytics.appDataSource(loaded ? 'cache' : 'none', 'sermon');
        logger.log('[Home] init: data fresh, skipping fetch');
      }
      logger.log('[Home] init: complete');
    };
    init().catch((e) => {
      logger.error('HomeScreen init failed:', e);
      setIsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- init must run once on mount; deps are stable callbacks

  // Fabric(New Architecture) 초기 렌더 버그 워크어라운드:
  // SPINNER→CONTENT 분기 교체(reconciliation)를 없애고 항상 같은 컴포넌트 트리를 렌더한다.
  // JsPager의 displayFixed가 tab 0을 display:none→flex로 전환할 때,
  // SafeAreaView+ScrollView가 이미 마운트된 상태로 함께 전환되어 Fabric이 올바르게 커밋한다.
  // 로딩/에러 상태는 absoluteFill overlay로 표시한다.
  const showSpinner = isLoading && !sermon;
  const showError = error && !sermon;
  logger.log('[Home] rendering, sermon=' + (sermon?.date ?? 'null') + ', isLoading=' + isLoading + ', showSpinner=' + showSpinner);
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={400}>
        {/* 카드(카테고리/날짜/유튜브 아이콘) 전체를 유튜브 바로가기 터치 영역으로 확장.
            cancelable={false}로 스크롤/스와이프 제스처가 터치를 탈취하지 못하게 하고,
            SVG는 pointerEvents="none"으로 터치를 부모 Pressable에 통과시킨다. */}
        <Pressable
          style={styles.seriesCard}
          onPress={openYoutube}
          cancelable={false}
        >
          <View style={styles.seriesCardText}>
            {sermon?.category ? (
              <Text style={styles.cardTitleText}>{sermon.category}</Text>
            ) : null}
            <Text style={styles.seriesDateText}>{sermon?.date}</Text>
          </View>
          <SvgIcon name="YoutubeButton" size={60} pointerEvents="none" />
        </Pressable>
        <View style={styles.smallDivider} />
        <Text style={styles.titleText} numberOfLines={0}>
          {processTitleText(sermon?.title)}
        </Text>
        <Text style={styles.indexText}>{sermonContent.index}</Text>
        <View style={styles.contentDivider} />
        <Text style={styles.contentText}>{sermonContent.content}</Text>
      </ScrollView>
      {showSpinner && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.textTertiary} />
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
      {/* 복사에는 표시용 줄바꿈이 없는 원문 제목을 넘긴다([#174]) */}
      <MeditationNoteSheet source="sermon" title={sermon?.title} />
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      // 화면 자체 배경은 항상 밝은 카드(surface) 톤 — 아래 seriesCard(background 톤)와
      // 대비되어야 하므로 네비게이션 기본 배경에 기대지 않고 명시적으로 지정한다.
      backgroundColor: colors.surface,
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
      color: colors.textPrimary,
      fontSize: 16,
      fontFamily: 'Pretendard-Regular',
    },
    titleText: {
      color: colors.textSecondary,
      fontSize: 28,
      fontFamily: 'Pretendard-Bold',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    contentText: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: 'Pretendard-Bold',
      lineHeight: 24,
      marginBottom: 32,
    },
    seriesCard: {
      backgroundColor: colors.background,
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
      color: colors.textSecondary,
      fontSize: 18,
      fontFamily: 'Pretendard-SemiBold',
    },
    seriesDateText: {
      color: colors.textTertiary,
      fontSize: 18,
      fontFamily: 'Pretendard-Regular',
    },
    smallDivider: {
      height: 3,
      width: 50,
      backgroundColor: colors.dividerStrong,
      marginBottom: 16,
    },
    contentDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginBottom: 16,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    errorContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: colors.textTertiary,
      fontSize: 16,
      fontFamily: 'Pretendard-Medium',
      marginBottom: 16,
    },
    retryButton: {
      borderWidth: 1,
      borderColor: colors.textTertiary,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 10,
    },
    retryText: {
      color: colors.textTertiary,
      fontSize: 16,
      fontFamily: 'Pretendard-Bold',
    },
  });

export default HomeScreen;
