import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import logger from './utils/logger';
import HomeScreen from './screens/HomeScreen';
import EditScreen from './screens/EditScreen';
import SettingsScreen from './screens/SettingsScreen';
import ForceUpdateModal from './components/ForceUpdateModal';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types/navigation';
import { useForceUpdate } from './hooks/useForceUpdate';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootStack = () => {
  return (
    <NavigationContainer onReady={() => logger.log('NavigationContainer ready')}>
      <Stack.Navigator>
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
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

  if (isChecking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <RootStack />
      {needsUpdate && showFallbackModal && config && (
        <ForceUpdateModal
          visible
          message={config.force_update_message}
          onPressUpdate={startUpdate}
        />
      )}
    </>
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
