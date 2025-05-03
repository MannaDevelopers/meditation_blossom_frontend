import { View, Text } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import { RootStackParamList } from '../types/navigation';

const EditScreen = () => {
  return (
    <View style={{ flex: 1, backgroundColor: 'yellow', marginHorizontal: 35, marginVertical: 60, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ backgroundColor: 'blue', marginVertical: 105, borderRadius: 10 }} >
        <WidgetPreview />
      </View>
    </View>
  );
}

export default EditScreen;