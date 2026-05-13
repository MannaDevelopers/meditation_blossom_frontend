import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, TouchableOpacity, Text, View, Image } from 'react-native';
import SvgIcon from '../components/SvgIcon';
import HomeScreen from '../screens/HomeScreen';
import DailyMannaScreen from '../screens/DailyMannaScreen';
import { RootStackParamList } from '../types/navigation';

export type MainTabParamList = {
  '주일 말씀': undefined;
  '매일 만나': undefined;
};

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

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
        onPress={() => navigation.navigate('SettingsScreen', {})}
        style={styles.settingsButton}
      >
        <SvgIcon name="SettingButton" size={20} color="black" />
      </TouchableOpacity>
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
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SharedHeader />
      <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />}>
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
});

export default MainTabNavigator;
