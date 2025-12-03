import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, View, Alert, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import messaging from '@react-native-firebase/messaging';
import { RootStackParamList } from '../types/navigation';
import { FCM_SERMON_KEY } from '../types/Sermon';
import WidgetUpdateModule from '../types/WidgetUpdateModule';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsScreen'>;

const SettingsScreen = ({ navigation, route }: Props) => {
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // 개발자 메뉴 토글 함수
  const toggleDeveloperMenu = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    if (newTapCount >= 5) {
      setShowDeveloperMenu(!showDeveloperMenu);
      setTapCount(0);
    }
  };

  // 로컬 스토리지 비우기
  const clearAndRefreshStorage = async () => {
    try {
      await AsyncStorage.removeItem(FCM_SERMON_KEY);

      console.log('Widget Prefernces cleared');
      await WidgetUpdateModule.onClear();
      route.params.onRefresh();
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
      console.log('AsyncStorage keys:', keys);

      // 각 키에 대한 데이터 검사
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`Key: ${key}`, JSON.parse(value || '{}'));
      }
    } catch (error) {
      console.error('Error inspecting AsyncStorage:', JSON.stringify(error, null, 2));
    }
  };

  // FCM 토큰 가져오기
  useEffect(() => {
    const getFCMToken = async () => {
      try {
        // 알림 권한 요청 (iOS)
        if (Platform.OS === 'ios') {
          const authStatus = await messaging().requestPermission();
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;
          
          if (!enabled) {
            console.log('FCM 알림 권한이 없습니다.');
            return;
          }
        }

        const token = await messaging().getToken();
        setFcmToken(token);
        console.log('FCM Token:', token);
      } catch (error) {
        console.error('FCM 토큰 가져오기 실패:', error);
      }
    };

    getFCMToken();
  }, []);

  // FCM 토큰 복사
  const copyFCMToken = async () => {
    if (fcmToken) {
      Clipboard.setString(fcmToken);
      Alert.alert('복사 완료', 'FCM 토큰이 클립보드에 복사되었습니다.\n\n다음 명령어로 테스트하세요:\nnode test_fcm.js sendTest [복사한 토큰]');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent', marginHorizontal: 35, marginVertical: 35, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'transparent', flex: 1, justifyContent: 'center', alignItems: 'center', width: 305 }}>
        {/* 헤더 영역 */}
        <View style={{ backgroundColor: 'transparent', flexDirection: 'row', width: 305, height: 30, marginBottom: 35, alignItems: 'center' }}>
          <Image source={require('../assets/image/20250416_meditation_icon.png')} style={{ backgroundColor: 'transparent', borderRadius: 15, width: 20, height: 20 }} />
          <Text style={{ color: '#49454F', fontSize: 20, letterSpacing: -1, fontFamily: "Pretendard-Medium", marginLeft: 8 }}>설정</Text>
          <TouchableOpacity onPress={() => { navigation.goBack(); }} style={{ marginLeft: 'auto', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#49454F', fontSize: 28, fontFamily: "Pretendard-Bold", lineHeight: 28 }}>←</Text>
          </TouchableOpacity>
        </View>

        {/* 메인 컨텐츠 영역 */}
        <ScrollView style={{ flex: 1, width: 305 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', flexGrow: 1, justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center' }}>
            {/* 제목 영역 */}
            <TouchableOpacity onPress={toggleDeveloperMenu} style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, height: 25, marginBottom: 20 }}>
              <Text style={{ color: "#A59EAE", fontSize: 20, letterSpacing: -3, fontFamily: "Pretendard-SemiBold" }}>앱 관리</Text>
            </TouchableOpacity>

            {/* 버튼 컨테이너 */}
            <View style={{ backgroundColor: 'transparent', width: 305, gap: 15 }}>
              {/* 데이터 새로고침 버튼 */}
              <TouchableOpacity
                onPress={clearAndRefreshStorage}
                style={{
                  backgroundColor: 'transparent',
                  width: 305,
                  height: 50,
                  borderRadius: 10,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#A59EAE',
                  borderStyle: 'solid'
                }}
              >
                <Text style={{ color: '#A59EAE', fontWeight: 'bold', fontSize: 18, textAlign: 'center', fontFamily: "Pretendard-Bold", letterSpacing: -1 }}>데이터 새로고침</Text>
              </TouchableOpacity>

              {/* 스토리지 검사 버튼 (개발자 히든 메뉴) */}
              {showDeveloperMenu && (
                <>
                  <TouchableOpacity
                    onPress={inspectStorage}
                    style={{
                      backgroundColor: 'transparent',
                      width: 305,
                      height: 50,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#49454F',
                      borderStyle: 'solid'
                    }}
                  >
                    <Text style={{ color: '#49454F', fontWeight: 'bold', fontSize: 18, textAlign: 'center', fontFamily: "Pretendard-Bold", letterSpacing: -1 }}>스토리지 검사</Text>
                  </TouchableOpacity>

                  {/* FCM 토큰 표시 및 복사 버튼 */}
                  <TouchableOpacity
                    onPress={copyFCMToken}
                    style={{
                      backgroundColor: 'transparent',
                      width: 305,
                      minHeight: 50,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#49454F',
                      borderStyle: 'solid',
                      paddingVertical: 10,
                      paddingHorizontal: 15
                    }}
                  >
                    <Text style={{ color: '#49454F', fontWeight: 'bold', fontSize: 18, textAlign: 'center', fontFamily: "Pretendard-Bold", letterSpacing: -1, marginBottom: 5 }}>FCM 토큰 복사</Text>
                    {fcmToken ? (
                      <Text style={{ color: '#A59EAE', fontSize: 10, textAlign: 'center', fontFamily: "Pretendard-Regular", lineHeight: 14 }} numberOfLines={2}>
                        {fcmToken.substring(0, 50)}...
                      </Text>
                    ) : (
                      <Text style={{ color: '#A59EAE', fontSize: 12, textAlign: 'center', fontFamily: "Pretendard-Regular" }}>
                        토큰 로딩 중...
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* 정보 영역 */}
            <View style={{ backgroundColor: 'transparent', width: 305, marginTop: 20, padding: 20, borderRadius: 10, borderWidth: 1, borderColor: '#A59EAE', borderStyle: 'dashed' }}>
              <Text style={{ color: '#A59EAE', fontSize: 14, textAlign: 'center', fontFamily: "Pretendard-Regular", lineHeight: 20 }}>
                데이터 새로고침: 교회 홈페이지에서 최신 설교 말씀을 받아옵니다.{/*'\n'*/}
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
          <View style={{ backgroundColor: 'transparent', width: 305, padding: 20, borderRadius: 10, borderWidth: 1, borderColor: '#A59EAE', borderStyle: 'solid', marginBottom: 20 }}>
            <Text style={{ color: '#49454F', fontSize: 16, textAlign: 'center', fontFamily: "Pretendard-Bold", marginBottom: 15, letterSpacing: -1 }}>
              About this app
            </Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#A59EAE', fontSize: 14, textAlign: 'center', fontFamily: "Pretendard-Regular", lineHeight: 18 }}>
                묵상만개{'\n'}
                Meditation Blossom
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://manna.or.kr/somoim/157228/')}
                style={{ alignItems: 'center' }}
              >
                <Text style={{
                  color: '#A59EAE',
                  fontSize: 14,
                  textAlign: 'center',
                  fontFamily: "Pretendard-Regular",
                  lineHeight: 18
                }}>
                  from 2025 만개하다 미니프로젝트 - 앱 만들기
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://manna.or.kr/somoim/130539/')}
                style={{ alignItems: 'center' }}
              >
                <Text style={{
                  color: '#A59EAE',
                  fontSize: 14,
                  textAlign: 'center',
                  fontFamily: "Pretendard-Regular",
                  lineHeight: 18
                }}>
                  개발: 만개하다 - 만나교회 개발자 모임
                </Text>
              </TouchableOpacity>
              <Text style={{ color: '#A59EAE', fontSize: 14, textAlign: 'center', fontFamily: "Pretendard-Regular", lineHeight: 18 }}>
                디자인: Somang Choi
              </Text>
              <Text style={{ color: '#A59EAE', fontSize: 14, textAlign: 'center', fontFamily: "Pretendard-Regular", lineHeight: 18 }}>
                버전: 1.0.0
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default SettingsScreen;