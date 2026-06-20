import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getMessaging,
  getToken,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import Svg, { Path } from 'react-native-svg';
import SvgIcon from '../components/SvgIcon';
import { RootStackParamList } from '../types/navigation';
import { FCM_SERMON_KEY } from '../types/Sermon';
import { FCM_QT_KEY } from '../types/QT';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import { fetchLatestSermonFromServer } from '../services/sermonService';
import { fetchLatestQtFromServer } from '../services/qtService';
import { logAnalytics } from '../utils/analytics';
import logger from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsScreen'>;

const SettingsScreen = ({ navigation }: Props) => {
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [youtubeLinkEnabled, setYoutubeLinkEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleDeveloperMenu = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);
    if (newTapCount >= 5) {
      setShowDeveloperMenu(!showDeveloperMenu);
      setTapCount(0);
    }
  };

  const setWidgetOption = async (value: boolean) => {
    setYoutubeLinkEnabled(value);
    const target = value ? 'youtube_link' : 'main_app';
    logAnalytics.widgetOptionChange(target);
    logAnalytics.setWidgetLinkTarget(target);
    try {
      if (WidgetUpdateModule) {
        await WidgetUpdateModule.setYoutubeLinkEnabled(value);
      }
    } catch (error) {
      logger.error('YouTube 링크 설정 저장 실패:', error);
      setYoutubeLinkEnabled(!value);
    }
  };

  const clearAndRefreshStorage = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    logAnalytics.dataRefresh();
    try {
      const [sermon, qt] = await Promise.all([
        fetchLatestSermonFromServer(),
        fetchLatestQtFromServer(),
      ]);
      const keysToRemove: string[] = [];
      if (sermon) keysToRemove.push(FCM_SERMON_KEY);
      if (qt) keysToRemove.push(FCM_QT_KEY);
      if (keysToRemove.length === 0) {
        Alert.alert('알림', '서버에서 데이터를 찾을 수 없습니다.');
        return;
      }
      await AsyncStorage.multiRemove(keysToRemove);
      if (sermon) await AsyncStorage.setItem(FCM_SERMON_KEY, JSON.stringify(sermon));
      if (qt) await AsyncStorage.setItem(FCM_QT_KEY, JSON.stringify(qt));
      if (WidgetUpdateModule) await WidgetUpdateModule.onClear();
      Alert.alert('완료', '데이터를 새로 불러왔습니다.');
    } catch (error) {
      logger.error('Error refreshing data:', error);
      const code = (error as { code?: string }).code ?? '';
      if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
        Alert.alert('네트워크 오류', '인터넷 연결을 확인하고 다시 시도해주세요.');
      } else if (code.includes('permission-denied') || code.includes('resource-exhausted')) {
        Alert.alert('서버 오류', '서버에 접근할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else {
        Alert.alert('오류', '데이터 불러오기에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const inspectStorage = async () => {
    logger.log('Inspecting AsyncStorage...');
    try {
      const keys = await AsyncStorage.getAllKeys();
      logger.log('AsyncStorage keys:', keys);
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        logger.log(`Key: ${key}`, JSON.parse(value || '{}'));
      }
    } catch (error) {
      logger.error('Error inspecting AsyncStorage:', JSON.stringify(error, null, 2));
    }
  };

  useEffect(() => {
    const loadYoutubeLinkSetting = async () => {
      try {
        if (WidgetUpdateModule) {
          const enabled = await WidgetUpdateModule.getYoutubeLinkEnabled();
          setYoutubeLinkEnabled(enabled);
        }
      } catch (error) {
        logger.error('YouTube 링크 설정 불러오기 실패:', error);
      }
    };
    loadYoutubeLinkSetting();
  }, []);

  useEffect(() => {
    const getFCMToken = async () => {
      try {
        if (Platform.OS === 'ios') {
          const authStatus = await requestPermission(getMessaging());
          const enabled =
            authStatus === AuthorizationStatus.AUTHORIZED ||
            authStatus === AuthorizationStatus.PROVISIONAL;
          if (!enabled) {
            logger.log('FCM 알림 권한이 없습니다.');
            return;
          }
        }
        const token = await getToken(getMessaging());
        setFcmToken(token);
        logger.log('FCM Token:', token);
      } catch (error) {
        logger.error('FCM 토큰 가져오기 실패:', error);
      }
    };
    getFCMToken();
  }, []);

  const copyFCMToken = async () => {
    if (fcmToken) {
      Clipboard.setString(fcmToken);
      Alert.alert(
        '복사 완료',
        'FCM 토큰이 클립보드에 복사되었습니다.\n\n다음 명령어로 테스트하세요:\nnode test_fcm.js sendTest [복사한 토큰]',
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          {/* 텍스트 '‹'는 폰트에 따라 깨져 보이고, BackButton.svg는 흰색 PNG라
              밝은 배경에서 안 보인다. 헤더 텍스트 색(#49454F)으로 인라인 셰브론을 그린다.
              pointerEvents="none"으로 아이콘 직접 탭도 부모로 통과시킨다(ISSUE-138 패턴). */}
          <Svg width={13} height={22} viewBox="0 0 13 22" pointerEvents="none">
            <Path
              d="M11 2 L3 11 L11 20"
              stroke="#49454F"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 위젯 설정 섹션 */}
        <Text style={styles.sectionLabel}>위젯 설정</Text>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionDescription}>위젯을 누르면 어디로 이동할까요?</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity style={styles.optionItem} onPress={() => setWidgetOption(false)}>
              <View style={styles.optionCard}>
                <View style={styles.appPreview}>
                  <Image
                    source={require('../assets/image/20250416_meditation_icon.png')}
                    style={styles.appPreviewIcon}
                  />
                  <Text style={styles.appPreviewText}>묵상만개</Text>
                </View>
              </View>
              <Text style={[styles.optionLabel, !youtubeLinkEnabled && styles.optionLabelActive]}>
                메인 앱 화면(기본)
              </Text>
              <View style={styles.radioButton}>
                {!youtubeLinkEnabled && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={() => setWidgetOption(true)}>
              <View style={styles.optionCard}>
                <SvgIcon name="YoutubeButton" size={30} />
              </View>
              <Text style={[styles.optionLabel, youtubeLinkEnabled && styles.optionLabelActive]}>
                유튜브 링크
              </Text>
              <View style={styles.radioButton}>
                {youtubeLinkEnabled && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 앱 관리 섹션 */}
        <TouchableOpacity onPress={toggleDeveloperMenu}>
          <Text style={styles.sectionLabel}>앱 관리</Text>
        </TouchableOpacity>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionDescription}>
            교회 홈페이지에서 최신 설교 말씀을 받아옵니다.
          </Text>
          <TouchableOpacity
            onPress={clearAndRefreshStorage}
            style={[styles.primaryButton, isRefreshing && styles.primaryButtonDisabled]}
            disabled={isRefreshing}
          >
            <Text style={styles.primaryButtonText}>
              {isRefreshing ? '불러오는 중...' : '데이터 새로고침'}
            </Text>
          </TouchableOpacity>

          {showDeveloperMenu && (
            <>
              <TouchableOpacity onPress={inspectStorage} style={styles.devButton}>
                <Text style={styles.devButtonText}>스토리지 검사</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={copyFCMToken} style={styles.fcmButton}>
                <Text style={styles.devButtonText}>FCM 토큰 복사</Text>
                {fcmToken ? (
                  <Text style={styles.fcmTokenText} numberOfLines={2}>
                    {fcmToken.substring(0, 50)}...
                  </Text>
                ) : (
                  <Text style={styles.fcmLoadingText}>토큰 로딩 중...</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.aboutSpacer} />
        {/* About this app — 콘텐츠가 짧으면 화면 하단 고정, 길면 스크롤 끝 */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>About this app</Text>
          <Text style={styles.aboutText}>묵상만개 Meditation Blossom</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://manna.or.kr/somoim/190510/')}>
            <Text style={styles.aboutText}>2026 만개하다 미니프로젝트</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://manna.or.kr/somoim/130539/')}>
            <Text style={styles.aboutText}>개발 : 만개하다 - 만나교회 개발자 모임</Text>
          </TouchableOpacity>
          <Text style={styles.aboutText}>디자인 : Somang Choi</Text>
          <Text style={styles.aboutText}>버전 : {DeviceInfo.getVersion()}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 27,
    marginTop: 16,
    marginBottom: 24,
    height: 30,
  },
  backButton: {
    // 아이콘 주변에 실제 터치 패딩을 더해 탭 영역을 넓힌다(hitSlop과 병행).
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    marginLeft: -10,
  },
  headerTitle: {
    color: '#49454F',
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
    letterSpacing: -1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  aboutSpacer: {
    flex: 1,
  },
  sectionLabel: {
    color: '#49454F',
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    marginHorizontal: 27,
    marginBottom: 0,
    paddingVertical: 12,
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginHorizontal: 8,
    marginBottom: 16,
    paddingHorizontal: 19,
    paddingBottom: 20,
    paddingTop: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  sectionDescription: {
    color: '#919191',
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 20,
  },
  optionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  optionCard: {
    width: 110,
    height: 70,
    backgroundColor: '#F4F4F4',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appPreview: {
    alignItems: 'center',
    gap: 4,
  },
  appPreviewIcon: {
    width: 15,
    height: 15,
    borderRadius: 8,
  },
  appPreviewText: {
    color: '#49454F',
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
  },
  optionLabel: {
    color: '#A59EAE',
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    textAlign: 'center',
  },
  optionLabelActive: {
    color: '#00A8DE',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#A59EAE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#00A8DE',
  },
  primaryButton: {
    backgroundColor: '#00A8DE',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#A59EAE',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
    letterSpacing: -1,
  },
  devButton: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#49454F',
    marginTop: 12,
  },
  devButtonText: {
    color: '#49454F',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    letterSpacing: -1,
  },
  fcmButton: {
    minHeight: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#49454F',
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 12,
  },
  fcmTokenText: {
    color: '#A59EAE',
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    lineHeight: 14,
    marginTop: 5,
  },
  fcmLoadingText: {
    color: '#A59EAE',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
  },
  aboutSection: {
    backgroundColor: '#E1E5F7',
    paddingHorizontal: 27,
    paddingVertical: 15,
    gap: 4,
  },
  aboutTitle: {
    color: '#49454F',
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  aboutText: {
    color: '#919191',
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 23,
  },
});

export default SettingsScreen;
