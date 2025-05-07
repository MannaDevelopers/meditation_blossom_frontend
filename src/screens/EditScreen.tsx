import { View, TouchableOpacity, Text } from 'react-native';
import WidgetPreview from '../components/WidgetPreview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import SvgIcon from '../components/SvgIcon';
import React, {useState} from 'react';
import styled from 'styled-components/native';

const TextAlignIconBox = styled.TouchableOpacity<{selected: boolean}>`
  width: 55;
  height: 55;
  justify-content: center;
  align-items: center;
  border-radius: 27px;
  border-color: ${({selected}) => (selected ? 'white' : 'transparent')};
  border-width: ${({selected}) => (selected ? '2px' : '0')};
  `;

const TextSettingItemBox = styled.Text<{selected: boolean}>`
  color: ${({selected}) => (selected ? '#FFCD16' : 'white')};
  width: 61;
  height: 40;
  font-size: 16;
  font-weight: bold;
  text-align: center;
  text-align-vertical: center;
`;

const MainCategoryIconBox = styled.TouchableOpacity<{selected: boolean}>`
  width: 71;
  height: 71;
  justify-content: center;
  align-items: center;
  background-color: ${({selected}) => (selected ? 'gray' : 'transparent')};
`;

type Props = NativeStackScreenProps<RootStackParamList, 'EditScreen'>;

const EditScreen = ({navigation}: Props) => {
  const [textAlignIconSelected, setTextAlignIconSelected] = useState<number>(0);
  const [textSettingItemSelected, setTextSettingItemSelected] = useState<number>(0);
  const [mainCategorySelected, setMainCategorySelected] = useState<number>(0);
  return (
    <View style={{flex: 1, backgroundColor:'black'}}>
    <View style={{ flex: 1, backgroundColor: 'black', marginHorizontal: 35, marginVertical: 60, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{backgroundColor: 'transparent', width: 305, height: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <TouchableOpacity onPress={() => {navigation.goBack();}}><SvgIcon name="BackButton" size={20} /></TouchableOpacity>
        <TouchableOpacity><Text style={{color: 'white', fontWeight: 'bold', fontSize: 20, textAlign: 'center', textAlignVertical: 'center'}}>저장</Text></TouchableOpacity>
      </View>
      <View style={{ backgroundColor: 'blue', marginVertical: 105, borderRadius: 20 }} >
        <WidgetPreview />
      </View>
      {/*Edit Tab*/}
      {/*Tab 1*/} 
      <View style={{ backgroundColor: 'black', width: 177, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 64, marginVertical: 15}} >
        <TextAlignIconBox selected={textAlignIconSelected === 0} onPress={() => setTextAlignIconSelected(0)} > 
        {/* <View style={{backgroundColor: 'blue', flex: 1, justifyContent: 'center', alignItems: 'center', width: 55, height: 55}} > */}
          <SvgIcon name="TextLeft" size={25} color='black'/>
        {/* </View> */}
        </TextAlignIconBox>
        <TextAlignIconBox selected={textAlignIconSelected === 1} onPress={() => setTextAlignIconSelected(1)} >
          <SvgIcon name="TextCenter" size={25}/>
        </TextAlignIconBox>
        <TextAlignIconBox selected={textAlignIconSelected === 2} onPress={() => setTextAlignIconSelected(2)} >
          <SvgIcon name="TextRight" size={25} />
        </TextAlignIconBox>
      </View>
{/* Tab 2 */}
<View style={{backgroundColor: 'black', flexDirection: 'row', width: 245, height: 40, marginHorizontal: 30, marginBottom: 15}} >
<TouchableOpacity onPress={() => setTextSettingItemSelected(0)}><TextSettingItemBox selected={textSettingItemSelected === 0}>정렬</TextSettingItemBox></TouchableOpacity>
<TouchableOpacity onPress={() => setTextSettingItemSelected(1)}><TextSettingItemBox selected={textSettingItemSelected === 1}>색상</TextSettingItemBox></TouchableOpacity>
<TouchableOpacity onPress={() => setTextSettingItemSelected(2)}><TextSettingItemBox selected={textSettingItemSelected === 2}>크기</TextSettingItemBox></TouchableOpacity>
<TouchableOpacity onPress={() => setTextSettingItemSelected(3)}><TextSettingItemBox selected={textSettingItemSelected === 3}>두께</TextSettingItemBox></TouchableOpacity>
{/* <TextSettingItemBox>색상</TextSettingItemBox>
<TextSettingItemBox>크기</TextSettingItemBox>
<TextSettingItemBox>두께</TextSettingItemBox> */}
</View>
{/* Tab 3 */}
<View style={{backgroundColor: 'transparent', flexDirection: 'row', width: 243, height: 71, marginHorizontal: 31, marginBottom: 60, justifyContent: 'space-between', alignItems: 'center'}} >
<MainCategoryIconBox selected={mainCategorySelected === 0} onPress={() => setMainCategorySelected(0)}>
<SvgIcon name="EditText" size={35}/>
</MainCategoryIconBox>
<MainCategoryIconBox selected={mainCategorySelected === 1} onPress={() => setMainCategorySelected(1)}>
<SvgIcon name="EditBackground" size={35}/>
</MainCategoryIconBox>
<MainCategoryIconBox selected={mainCategorySelected === 2} onPress={() => setMainCategorySelected(2)}>
<SvgIcon name="EditStyle" size={35}/>
</MainCategoryIconBox>
  </View>

</View>
</View>
);
}

export default EditScreen;