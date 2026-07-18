import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, SafeAreaView, StatusBar } from 'react-native';
import logger from './utils/logger';
import { logAnalytics } from './utils/analytics';
import WidgetUpdateModule from './types/WidgetUpdateModule';
import MainTabNavigator from './navigation/MainTabNavigator';
import EditScreen from './screens/EditScreen';
import SettingsScreen from './screens/SettingsScreen';
import ForceUpdateModal from './components/ForceUpdateModal';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types/navigation';
import { useForceUpdate } from './hooks/useForceUpdate';


const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_DEEP_LINK_MAP: Record<string, string> = {
  daily_manna: '매일 만나',
  sunday_sermon: '주일 말씀',
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['meditationblossom://'],
  getStateFromPath(path) {
    const tab = path.match(/[?&]tab=([^&]*)/)?.[1];
    const tabName = (tab && TAB_DEEP_LINK_MAP[tab]) ?? '주일 말씀';
    return {
      routes: [{ name: 'MainTabs', state: { routes: [{ name: tabName }] } }],
    };
  },
};

const RootStack = () => {
  return (
    <NavigationContainer linking={linking} onReady={() => logger.log('NavigationContainer ready')}>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditScreen"
          component={EditScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

function App(): React.JSX.Element {
  const { isChecking, needsUpdate, config, showFallbackModal, startUpdate } =
    useForceUpdate();

  useEffect(() => {
    WidgetUpdateModule?.getYoutubeLinkEnabled?.()
      .then((enabled: boolean) => {
        logAnalytics.setWidgetLinkTarget(enabled ? 'youtube_link' : 'main_app');
      })
      .catch((e: unknown) => logger.warn('App: widget link target 읽기 실패', e));
  }, []);

  if (isChecking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor : '#fff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <RootStack />
        {needsUpdate && showFallbackModal && config && (
          <ForceUpdateModal
            visible
            message={config.force_update_message}
            onPressUpdate={startUpdate}
          />
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
