import { useEffect, useState } from 'react';
import {View, Text, ImageBackground} from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';

const regex = /본문\s*[:：]?\s*([^\n]+?\d+:\d+(?:-\d+)?)/;
const extractContent = (text: string) : { index: string; content: string } => {
  // 전처리: 개행이 없는 텍스트에 적절한 개행 추가
  let processedText = text;
  if (!text.includes('\n')) {
    // 성경 구절 번호 다음에 개행 추가
    processedText = text.replace(/(\d+:\d+(?:-\d+)?)\s+/, '$1\n');
    
    // 문장 단위로 개행 추가 (마침표, 느낌표, 물음표 다음에)
    processedText = processedText.replace(/([.!?])\s+/g, '$1\n');
    
    // "아멘" 다음에 개행 추가
    processedText = processedText.replace(/(아멘)\s*$/, '$1\n');
  }

  const match = processedText.match(regex);
  if (!match) {
    return { index: '본문을 찾을 수 없습니다.', content: '' };
  }
  const verse = match[1].trim();
  const contentStartIndex = processedText.indexOf(verse) + verse.length;
  const content = processedText.slice(contentStartIndex).trim();

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
    } else {
      setExtractedContent({ index: '', content: '' });
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