import React from 'react';
import logger from './utils/logger';
import HomeScreen from './screens/HomeScreen';
import EditScreen from './screens/EditScreen';
import SettingsScreen from './screens/SettingsScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootStack = () => {
  logger.log('🚀 RootStack component rendering');
  
  return (
    <NavigationContainer onReady={() => logger.log('✅ NavigationContainer ready')}>
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
  logger.log('🚀 App component rendering');
  
  return (
    <RootStack />
  );
}


export default App;
