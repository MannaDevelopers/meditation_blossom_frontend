import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import DailyMannaScreen from '../screens/DailyMannaScreen';

export type MainTabParamList = {
  주일말씀: undefined;
  매일만나: undefined;
};

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#49454F',
        tabBarInactiveTintColor: '#A59EAE',
        tabBarIndicatorStyle: { backgroundColor: '#49454F' },
        tabBarLabelStyle: {
          fontSize: 14,
          fontFamily: 'Pretendard-SemiBold',
        },
        tabBarStyle: {
          backgroundColor: 'white',
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tab.Screen name="주일말씀" component={HomeScreen} />
      <Tab.Screen name="매일만나" component={DailyMannaScreen} />
    </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});

export default MainTabNavigator;
