import React, { useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, TouchableOpacity, Text, View, Image, Dimensions } from 'react-native';
// JsPager는 metro.config.js의 resolveRequest를 통해 주입된다.
// iOS에서 react-native-tab-view/Pager.ios → src/navigation/JsPager.tsx 로 리다이렉트되어
// RNCViewPager 네이티브 모듈 없이 탭 전환이 동작한다.
import SvgIcon from '../components/SvgIcon';
import HomeScreen from '../screens/HomeScreen';
import DailyMannaScreen from '../screens/DailyMannaScreen';
import { RootStackParamList } from '../types/navigation';
import { logAnalytics } from '../utils/analytics';
import { fetchLatestSermonFromAsyncStorage } from '../services/sermonService';
import { fetchLatestQtFromAsyncStorage } from '../services/qtService';
import logger from '../utils/logger';

type WidgetSource = 'sermon' | 'qt';

export type MainTabParamList = {
  '주일 말씀': undefined;
  '매일 만나': undefined;
};

const Tab = createMaterialTopTabNavigator<MainTabParamList>();
const SCREEN_WIDTH = Dimensions.get('window').width;

// 다크모드 도입 전까지는 헤더가 항상 흰 배경이라 검정 고정. 다크모드가 생기면
// 테마의 배경색에 맞춰(어두운 배경일 때는 흰색으로) 전환해야 한다.
const EDIT_ICON_COLOR = '#000000';
const SharedHeader = ({ activeSource }: { activeSource: WidgetSource }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // 위젯 디자인 편집([#169], [ISSUE-236]) 진입 버튼 — 어느 탭에서 눌러도 두 콘텐츠(주일
  // 말씀/QT)를 모두 EditScreen에 전달해 소스 필 전환 시 별도 로딩 없이 바로 편집할 수 있게
  // 하고, 진입 시 활성화할 소스는 지금 보고 있던 탭으로 맞춘다. AsyncStorage는 각 탭
  // 화면이 이미 최신 상태로 채워두는 소스라 여기서 훅으로 다시 구독하지 않고 필요한
  // 시점에만 1회 읽는다.
  const openEditScreen = async () => {
    let sermon;
    let qt;
    try {
      [sermon, qt] = await Promise.all([
        fetchLatestSermonFromAsyncStorage(),
        fetchLatestQtFromAsyncStorage(),
      ]);
    } catch (e) {
      logger.error('SharedHeader: 편집 화면 진입용 콘텐츠 로드 실패', e);
    }
    navigation.navigate('EditScreen', {
      sermon: sermon ?? undefined,
      qt: qt ?? undefined,
      initialSource: activeSource,
    });
  };

  return (
    <View style={styles.header}>
      <Image
        source={require('../assets/image/20250416_meditation_icon.png')}
        style={styles.icon}
      />
      <Text style={styles.appTitle}>묵상만개</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={openEditScreen}
          style={styles.editButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <SvgIcon name="EditPencil" size={22} fill={EDIT_ICON_COLOR} pointerEvents="none" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('SettingsScreen')}
          style={styles.settingsButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          {/* iOS에서 react-native-svg가 자체 터치 responder가 되어 아이콘을 직접 누르면
              터치를 삼키는 문제가 있어, pointerEvents="none"으로 부모 TouchableOpacity에 통과시킨다.
              (YouTube 버튼과 동일한 ISSUE-138 패턴) */}
          <SvgIcon name="SettingButton" size={24} pointerEvents="none" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const CustomTabBar = ({ state, navigation }: MaterialTopTabBarProps) => {
  return (
    <View>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
              logAnalytics.tabSwitch(index === 0 ? 'sunday_sermon' : 'daily_qt');
            }
          };
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tabButton, isFocused && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.separator} />
    </View>
  );
};

const MainTabNavigator = () => {
  // 편집 화면 진입 버튼(SharedHeader)이 "지금 보고 있던 탭"을 EditScreen의 초기 소스 필로
  // 넘기기 위해 활성 탭을 추적한다([ISSUE-236]). SharedHeader는 Tab.Navigator 밖의 형제
  // 컴포넌트라 탭 state를 직접 구독할 수 없어, Tab.Navigator의 screenListeners로 상태 변화를
  // 끌어올린다.
  const [activeSource, setActiveSource] = useState<WidgetSource>('sermon');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SharedHeader activeSource={activeSource} />
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        initialLayout={{ width: SCREEN_WIDTH }}
        screenListeners={{
          state: (e) => {
            const index = (e.data as { state: { index: number } }).state.index;
            setActiveSource(index === 0 ? 'sermon' : 'qt');
          },
        }}
      >
        <Tab.Screen name="주일 말씀" component={HomeScreen} />
        <Tab.Screen name="매일 만나" component={DailyMannaScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    height: 44,
    marginHorizontal: 27,
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  icon: {
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
  headerActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    // 아이콘 주변에 실제 터치 가능한 패딩을 더해 탭 영역을 넓힌다.
    padding: 7,
  },
  settingsButton: {
    // 아이콘(24px) 주변에 실제 터치 가능한 패딩을 더해 탭 영역을 넓힌다.
    // 우측 끝에 위치해 hitSlop만으로는 화면 밖으로 잘려 효과가 제한적이므로 패딩을 병행.
    padding: 10,
    marginRight: -10,
  },
  tabBarContainer: {
    flexDirection: 'row',
    marginHorizontal: 27,
    marginVertical: 8,
    height: 60,
    backgroundColor: '#F3F4F9',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    height: 45,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#00A8DE',
  },
  tabLabel: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: '#919191',
    // Android는 폰트 ascent/descent에 따라 비대칭 padding(includeFontPadding)을 더해,
    // 시스템 글자 크기/굵게 설정 시 글자가 테두리 중앙보다 아래로 쳐진다.
    // iOS에는 해당 개념이 없어 항상 중앙 정렬된다. Android에서만 padding을 끄고
    // textAlignVertical로 수직 중앙 정렬을 강제한다(두 속성 모두 iOS에서는 무시됨).
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tabLabelActive: {
    color: '#00A8DE',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default MainTabNavigator;
