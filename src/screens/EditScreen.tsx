import { View } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import { RootStackParamList } from '../types/navigation';
import SvgIcon from '../components/SvgIcon';


const EditScreen = () => {
  return (
    <View style={{ flex: 1, backgroundColor: 'yellow', marginHorizontal: 35, marginVertical: 60, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'blue', marginVertical: 105, borderRadius: 20 }} >
        <WidgetPreview />
      </View>
      {/*Edit Tab*/}
      {/*Tab 1*/}
      <View style={{ backgroundColor: 'red', width: 305, marginHorizontal: 64, marginVertical: 55}}>
        <SvgIcon name="TextLeft" size={24} onPress={() => {}} />
        </View>
    </View>
  );
}

export default EditScreen;