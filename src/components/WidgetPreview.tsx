import {View, Text, ImageBackground} from 'react-native';

const WidgetPreview = () => {
  return (
    <View style={{width: 300, height: 270, backgroundColor: 'pink', justifyContent: 'center', alignItems: 'center', borderRadius: 5}}>
      <ImageBackground source={require('../assets/image/BackgroundImg.png')} style={{backgroundColor: 'red', flex:1, borderRadius: 15}} >
      <View style={{backgroundColor: 'transparent', marginVertical: 50, marginHorizontal: 30}}>
        <Text style={{color: 'black', fontSize: 20, lineHeight: 24, fontWeight: 'bold', marginBottom: 30, fontFamily: "Pretendard-Regular"}}>또 비유로 말씀하시되 천국은 마치 여자가 가루 서 말 속에 갖다 넣어 전부 부풀게 한 누룩과 같으니라</Text>
        <Text style={{color: 'black', fontSize: 16, fontFamily: "Pretendard-Regular"}}>마태복음 13:33</Text> 
        </View>
        </ImageBackground>
        </View>
  );
}

export default WidgetPreview;