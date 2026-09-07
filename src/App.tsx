import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View, SafeAreaView, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import logger from './utils/logger';
import { logAnalytics } from './utils/analytics';
import WidgetUpdateModule from './types/WidgetUpdateModule';
import MainTabNavigator from './navigation/MainTabNavigator';
import EditScreen from './screens/EditScreen';
import ImageCropScreen from './screens/ImageCropScreen';
import SettingsScreen from './screens/SettingsScreen';
import ForceUpdateModal from './components/ForceUpdateModal';
import {
  DarkTheme,
  DefaultTheme,
  LinkingOptions,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types/navigation';
import { useForceUpdate } from './hooks/useForceUpdate';
import { useAppTheme } from './hooks/useAppTheme';
import { ThemeColors } from './theme/colors';


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

function buildNavigationTheme(base: Theme, colors: ThemeColors): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.divider,
    },
  };
}

const RootStack = ({ navigationTheme }: { navigationTheme: Theme }) => {
  return (
    <NavigationContainer
      linking={linking}
      theme={navigationTheme}
      onReady={() => logger.log('NavigationContainer ready')}
    >
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
          name="ImageCropScreen"
          component={ImageCropScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
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
  const { colors, isDark } = useAppTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(isDark ? DarkTheme : DefaultTheme, colors),
    [isDark, colors],
  );

  useEffect(() => {
    WidgetUpdateModule?.getYoutubeLinkEnabled?.()
      .then((enabled: boolean) => {
        logAnalytics.setWidgetLinkTarget(enabled ? 'youtube_link' : 'main_app');
      })
      .catch((e: unknown) => logger.warn('App: widget link target 읽기 실패', e));
  }, []);

  if (isChecking) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.surface} />
        <RootStack navigationTheme={navigationTheme} />
          {needsUpdate && showFallbackModal && config && (
            <ForceUpdateModal
              visible
              message={config.force_update_message}
              onPressUpdate={startUpdate}
            />
          )}
      </SafeAreaView>
    </GestureHandlerRootView>
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
