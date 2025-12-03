import { useEffect, useState } from 'react';
import {View, Text, ImageBackground} from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';

// Android VerseParser와 동일한 정규식 사용
const bookNameRegex = /(본문\s*[:：]?\s*)?([^\d\s]+ ?\d+:\d+(?:-\d+)?(?:,\s*[^\d\s]+ ?\d+:\d+(?:-\d+)?)*)/;
const verseNumberRegex = /\d+/g;

const extractContent = (text: string) : { index: string; content: string } => {
  // 1. 책 이름과 장:절 추출
  const match = text.match(bookNameRegex);
  if (!match) {
    return { index: '본문을 찾을 수 없습니다.', content: '' };
  }
  
  const bookName = match[2].trim();
  
  // 2. 본문 내용 추출 (책 이름 이후의 텍스트)
  const matchIndex = text.indexOf(match[0]);
  const matchLength = match[0].length;
  const contentAfterBookName = text.slice(matchIndex + matchLength).trim();
  
  if (!contentAfterBookName) {
    return { index: bookName, content: '본문 내용을 찾을 수 없습니다.' };
  }
  
  // 3. 구절 번호로 분리
  const verseMatches = Array.from(contentAfterBookName.matchAll(verseNumberRegex));
  
  if (verseMatches.length === 0) {
    // 구절 번호가 없으면 전체 텍스트 사용
    return { index: bookName, content: contentAfterBookName };
  }
  
  // 4. 모든 구절 추출
  const verseTexts: string[] = [];
  
  for (let i = 0; i < verseMatches.length; i++) {
    const currentMatch = verseMatches[i];
    const verseNumber = currentMatch[0];
    const verseStartIndex = currentMatch.index!;
    const verseEndIndex = verseStartIndex + verseNumber.length;
    
    let verseText: string;
    
    if (i < verseMatches.length - 1) {
      // 다음 구절이 있으면 현재 구절 번호 다음부터 다음 구절 번호 전까지
      const nextVerseStartIndex = verseMatches[i + 1].index!;
      verseText = contentAfterBookName.slice(verseEndIndex, nextVerseStartIndex).trim();
    } else {
      // 마지막 구절이면 구절 번호 다음부터 끝까지
      verseText = contentAfterBookName.slice(verseEndIndex).trim();
    }
    
    // 구절 번호와 텍스트를 함께 저장
    verseTexts.push(`${verseNumber} ${verseText}`);
  }
  
  // 모든 구절을 합쳐서 반환
  const fullContent = verseTexts.join('\n\n');

  return {
    index: bookName,
    content: fullContent
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