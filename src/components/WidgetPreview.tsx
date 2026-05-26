import { useMemo } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { extractContent } from '../utils/sermonParser';

const WidgetPreview = ({ content }: { content: string | undefined }) => {
  const extractedContent = useMemo(
    () => (content ? extractContent(content) : { index: '', content: '' }),
    [content],
  );

  return (
    <ImageBackground
      source={require('../assets/image/BackgroundImg.png')}
      style={styles.background}
    >
      <View style={styles.inner}>
        <Text style={styles.contentText}>{extractedContent.content}</Text>
        <Text style={styles.indexText}>{extractedContent.index}</Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: 'transparent',
    width: 300,
    height: 270,
    borderRadius: 15,
  },
  inner: {
    backgroundColor: 'transparent',
    marginVertical: 50,
    marginHorizontal: 30,
  },
  contentText: {
    color: 'black',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    fontFamily: 'Pretendard-Regular',
  },
  indexText: {
    color: 'black',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
  },
});

export default WidgetPreview;
