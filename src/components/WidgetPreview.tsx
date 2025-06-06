import { useEffect, useState } from 'react';
import {View, Text, ImageBackground} from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';

const regex = /본문\s*[:：]?\s*([^\d\s]+ ?\d+:\d+(?:-\d+)?)/;
const extractContent = (text: string) : { index: string; content: string } => {
  const match = text.match(regex);
  if (!match) {
    return { index: '본문을 찾을 수 없습니다.', content: '' };
  }
  const verse = match[1].trim();
  const contentStartIndex = text.indexOf(verse) + verse.length;
  const content = text.slice(contentStartIndex).trim();

  return {
    index: verse,
    content: content
  }
};

const WidgetPreview = ({content}: {content: string | undefined}) => {
  const [extractedContent, setExtractedContent] = useState<{ index: string; content: string }>({ index: '', content: '' });

  useEffect(() => {
    if (content) {
      const { index, content: extractedContent } = extractContent(content);
      setExtractedContent({ index, content: extractedContent });
    }
  }, [content]);

  return (
    <GestureHandlerRootView style={{width: 300, height: 270, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', borderRadius: 5}}>
      <ImageBackground source={require('../assets/image/BackgroundImg.png')} style={{backgroundColor: 'transparent', flex:1, borderRadius: 15}} >
        <ScrollView style={{backgroundColor: 'transparent', marginVertical: 50, marginHorizontal: 30}}>
          <Text style={{color: 'black', fontSize: 20, lineHeight: 24, fontWeight: 'bold', marginBottom: 30, fontFamily: "Pretendard-Regular"}}>{extractedContent.content}</Text>
          <Text style={{color: 'black', fontSize: 16, fontFamily: "Pretendard-Regular"}}>{extractedContent.index}</Text>
        </ScrollView>
      </ImageBackground>
    </GestureHandlerRootView>
  );
}

export default WidgetPreview;