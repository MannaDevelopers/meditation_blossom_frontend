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
import messaging from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import { RootStackParamList } from '../types/navigation';
import { FCM_SERMON_KEY } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import logger from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsScreen'>;

const SettingsScreen = ({ navigation, route }: Props) => {
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const toggleDeveloperMenu = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);
    if (newTapCount >= 5) {
      setShowDeveloperMenu(!showDeveloperMenu);
      setTapCount(0);
    }
  };

  const clearAndRefreshStorage = async () => {
    try {
      await AsyncStorage.removeItem(FCM_SERMON_KEY);
      logger.log('Widget Preferences cleared');
      await WidgetUpdateModule.onClear();
      route.params.onRefresh();
    } catch (error) {
      logger.error('Error clearing local storage:', error);
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
    const getFCMToken = async () => {
      try {
        if (Platform.OS === 'ios') {
          const authStatus = await messaging().requestPermission();
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;
          if (!enabled) {
            logger.log('FCM 알림 권한이 없습니다.');
            return;
          }
        }
        const token = await messaging().getToken();
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
      <View style={styles.innerContainer}>
        {/* 헤더 영역 */}
        <View style={styles.header}>
          <Image
            source={require('../assets/image/20250416_meditation_icon.png')}
            style={styles.icon}
          />
          <Text style={styles.headerTitle}>설정</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        {/* 메인 컨텐츠 영역 */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.topSection}>
            {/* 제목 영역 */}
            <TouchableOpacity onPress={toggleDeveloperMenu} style={styles.sectionTitle}>
              <Text style={styles.sectionTitleText}>앱 관리</Text>
            </TouchableOpacity>

            {/* 버튼 컨테이너 */}
            <View style={styles.buttonContainer}>
              {/* 데이터 새로고침 버튼 */}
              <TouchableOpacity onPress={clearAndRefreshStorage} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>데이터 새로고침</Text>
              </TouchableOpacity>

              {/* 스토리지 검사 버튼 (개발자 히든 메뉴) */}
              {showDeveloperMenu && (
                <>
                  <TouchableOpacity onPress={inspectStorage} style={styles.devButton}>
                    <Text style={styles.devButtonText}>스토리지 검사</Text>
                  </TouchableOpacity>

                  {/* FCM 토큰 표시 및 복사 버튼 */}
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

            {/* 정보 영역 */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                데이터 새로고침: 교회 홈페이지에서 최신 설교 말씀을 받아옵니다.
                {showDeveloperMenu && (
                  <>
                    {'\n'}스토리지 검사: 저장된 데이터를 콘솔에서 확인합니다.
                    {'\n'}FCM 토큰 복사: test_fcm.js에서 사용할 토큰을 복사합니다.
                  </>
                )}
              </Text>
            </View>
          </View>

          {/* 통합된 앱 정보 영역 */}
          <View style={styles.aboutBox}>
            <Text style={styles.aboutTitle}>About this app</Text>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutText}>
                묵상만개{'\n'}Meditation Blossom
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://manna.or.kr/somoim/157228/')}
                style={styles.linkButton}
              >
                <Text style={styles.aboutText}>
                  from 2025 만개하다 미니프로젝트 - 앱 만들기
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://manna.or.kr/somoim/130539/')}
                style={styles.linkButton}
              >
                <Text style={styles.aboutText}>개발: 만개하다 - 만나교회 개발자 모임</Text>
              </TouchableOpacity>
              <Text style={styles.aboutText}>디자인: Somang Choi</Text>
              <Text style={styles.aboutText}>버전: {DeviceInfo.getVersion()}</Text>
            </View>
          </View>
        </ScrollView>
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
  innerContainer: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 305,
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
  headerTitle: {
    color: '#49454F',
    fontSize: 20,
    letterSpacing: -1,
    fontFamily: 'Pretendard-Medium',
    marginLeft: 8,
  },
  backButton: {
    marginLeft: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#49454F',
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
    lineHeight: 28,
  },
  scrollView: {
    flex: 1,
    width: 305,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
  },
  sectionTitle: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    width: 305,
    height: 25,
    marginBottom: 20,
  },
  sectionTitleText: {
    color: '#A59EAE',
    fontSize: 20,
    letterSpacing: -3,
    fontFamily: 'Pretendard-SemiBold',
  },
  buttonContainer: {
    backgroundColor: 'transparent',
    width: 305,
    gap: 15,
  },
  primaryButton: {
    backgroundColor: 'transparent',
    width: 305,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A59EAE',
  },
  primaryButtonText: {
    color: '#A59EAE',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    letterSpacing: -1,
  },
  devButton: {
    backgroundColor: 'transparent',
    width: 305,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#49454F',
  },
  devButtonText: {
    color: '#49454F',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    letterSpacing: -1,
  },
  fcmButton: {
    backgroundColor: 'transparent',
    width: 305,
    minHeight: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#49454F',
    paddingVertical: 10,
    paddingHorizontal: 15,
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
  infoBox: {
    backgroundColor: 'transparent',
    width: 305,
    marginTop: 20,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A59EAE',
    borderStyle: 'dashed',
  },
  infoText: {
    color: '#A59EAE',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
  },
  aboutBox: {
    backgroundColor: 'transparent',
    width: 305,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A59EAE',
    marginBottom: 20,
  },
  aboutTitle: {
    color: '#49454F',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    marginBottom: 15,
    letterSpacing: -1,
  },
  aboutContent: {
    gap: 8,
  },
  aboutText: {
    color: '#A59EAE',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    lineHeight: 18,
  },
  linkButton: {
    alignItems: 'center',
  },
});

export default SettingsScreen;
