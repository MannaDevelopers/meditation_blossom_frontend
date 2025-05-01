import { View, Text, StyleSheet, ScrollView, Image, Button, TouchableOpacity, ImageBackground } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
const HomeScreen = () => {
  return (
    <View style={{ flex: 1, backgroundColor: 'white', marginHorizontal: 35, marginVertical: 35, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'yellow', flex: 1 }}>
        <View style={{ backgroundColor: 'red', flexDirection: 'row', width: 305, height: 20, marginBottom: 35 }}>
          <Image source={require('../assets/image/20250416_meditation_icon.png')} style={{ backgroundColor: 'transparent', borderRadius: 15, width: 20, height: 20 }} />
          <Text style={{ color: '#49454F', fontSize: 20, letterSpacing: -1, fontFamily: "Pretendard-Medium" }}>묵상만개</Text>
        </View>
        <View style={{ backgroundColor: 'yellow', justifyContent: 'center', alignItems: 'center', width: 305, height: 25 }}>
          <Text style={{ color: "#A59EAE", fontSize: 20, letterSpacing: -3, fontFamily: "Pretendard-SemiBold" }}>2025-03-23</Text>
        </View>
        <View style={{ backgroundColor: 'green', justifyContent: 'center', alignItems: 'center', width: 305, height: 30 }}>
          <Text style={{ color: "#A59EAE", fontSize: 24, letterSpacing: -3, fontFamily: "Pretendard-Bold" }}>누룩, 복음과 고난을 받으라</Text>
        </View>
        <View style={{ backgroundColor: 'pink', width: 305, height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <WidgetPreview />
        </View>
        <View style={{ backgroundColor: 'red', width: 305, height: 38, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => console.log('Button pressed')}>
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