import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import SvgIcon from '../components/SvgIcon';
import HomeScreen from '../screens/HomeScreen';
import DailyMannaScreen from '../screens/DailyMannaScreen';
import { RootStackParamList } from '../types/navigation';
import { logAnalytics } from '../utils/analytics';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

const TAB_ID_MAP: Record<string, number> = {
  sunday_sermon: 0,
  daily_manna: 1,
};

const TAB_LABELS = ['주일 말씀', '매일 만나'] as const;

const SharedHeader = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.header}>
      <Image
        source={require('../assets/image/20250416_meditation_icon.png')}
        style={styles.icon}
      />
      <Text style={styles.appTitle}>묵상만개</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('SettingsScreen')}
        style={styles.settingsButton}
      >
        <SvgIcon name="SettingButton" size={20} />
      </TouchableOpacity>
    </View>
  );
};

const MainTabNavigator = ({ route }: Props) => {
  const initialIndex = TAB_ID_MAP[route.params?.tab ?? 'sunday_sermon'] ?? 0;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // 한 번 마운트된 탭은 언마운트하지 않고 숨김 처리 (상태 보존)
  const mountedTabs = useRef(new Set<number>([initialIndex]));

  useEffect(() => {
    const tab = route.params?.tab;
    const idx = TAB_ID_MAP[tab ?? 'sunday_sermon'] ?? 0;
    setActiveIndex(idx);
  }, [route.params?.tab]);

  const handleTabPress = (index: number) => {
    if (index === activeIndex) return;
    mountedTabs.current.add(index);
    setActiveIndex(index);
    logAnalytics.tabSwitch(index === 0 ? 'sunday_sermon' : 'daily_qt');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SharedHeader />
      {/* 탭 바 */}
      <View style={styles.tabBarContainer}>
        {TAB_LABELS.map((label, index) => {
          const isFocused = activeIndex === index;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => handleTabPress(index)}
              style={[styles.tabButton, isFocused && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.separator} />
      {/* 화면 내용 — 한 번 마운트된 탭은 숨김 처리만 하여 상태 유지 */}
      <View style={styles.screenContainer}>
        {mountedTabs.current.has(0) && (
          <View style={[styles.screen, activeIndex !== 0 && styles.hidden]}>
            <HomeScreen />
          </View>
        )}
        {mountedTabs.current.has(1) && (
          <View style={[styles.screen, activeIndex !== 1 && styles.hidden]}>
            <DailyMannaScreen />
          </View>
        )}
      </View>
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
    height: 30,
    marginHorizontal: 27,
    marginTop: 16,
    marginBottom: 8,
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
  settingsButton: {
    marginLeft: 'auto',
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
  screenContainer: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});

export default MainTabNavigator;
