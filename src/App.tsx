import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import HomeScreen from './screens/HomeScreen';
import TempSermonScreen from './screens/TempSermonScreen';
import EditScreen from './screens/EditScreen';

function App(): React.JSX.Element {

  return (
    // <EditScreen/>
    // <TempSermonScreen/>
    <View style={{flex: 1, backgroundColor: 'white'}}>
    <HomeScreen/>
    </View>
    // <Text>Hello</Text>
  );
}


export default App;
