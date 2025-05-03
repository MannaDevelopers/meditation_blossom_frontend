import { View, Text, StyleSheet, ScrollView, Image, Button, TouchableOpacity, ImageBackground } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import Icon from 'react-native-vector-icons/AntDesign';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeScreen'>;


const HomeScreen = ({navigation}: Props) => {
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', marginHorizontal: 35, marginVertical: 35, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'transparent', flex: 1 }}>
        <View style={{ backgroundColor: 'transparent', flexDirection: 'row', width: 305, height: 30, marginBottom: 35, alignItems: 'center'}}>
          <Image source={require('../assets/image/20250416_meditation_icon.png')} style={{ backgroundColor: 'transparent', borderRadius: 15, width: 20, height: 20 }} />
          <Text style={{ color: '#49454F', fontSize: 20, letterSpacing: -1, fontFamily: "Pretendard-Medium", marginLeft: 8}}>묵상만개</Text>
          {/* <Icon name="setting" size={20} color="#49454F" style={{ marginLeft: 'auto' }} /> */}
          <TouchableOpacity onPress={() => navigation.navigate('SettingsScreen')} style={{ marginLeft: 'auto' }}>
            <Image source={require('../assets/image/Settings.png')} style={{ backgroundColor: 'transparent', borderRadius: 15, width: 20, height: 20 }} />
          </TouchableOpacity>
        </View>
        <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, height: 25 }}>
          <Text style={{ color: "#A59EAE", fontSize: 20, letterSpacing: -3, fontFamily: "Pretendard-SemiBold" }}>2025-03-23</Text>
        </View>
        <View style={{ backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', width: 305, height: 30 }}>
          <Text style={{ color: "#A59EAE", fontSize: 24, letterSpacing: -3, fontFamily: "Pretendard-Bold" }}>누룩, 복음과 고난을 받으라</Text>
        </View>
        <View style={{ backgroundColor: 'transparent', width: 305, height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <WidgetPreview />
        </View>
        <View style={{ backgroundColor: 'transparent', width: 305, height: 38, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('EditScreen')}>
            <ImageBackground
              source={require('../assets/image/EditButton.png')}
              style={{ width: 62, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
              imageStyle={{ borderRadius: 10 }}
            >
              <Text style={{ color: 'white', fontSize: 20, fontFamily: "Pretendard-Bold", textAlign: 'center', letterSpacing: -1 }}>편집</Text>
            </ImageBackground>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default HomeScreen