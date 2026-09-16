import { Platform, StyleProp, StyleSheet, Text, TextInput, TextStyle } from 'react-native';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
}

/**
 * 롱프레스로 원하는 구간만 선택·복사할 수 있는 읽기 전용 텍스트([#283], [#166]).
 *
 * 플랫폼마다 "부분 선택이 되는 쪽"이 정반대라 하나로 통일할 수 없다:
 *  - iOS: <Text selectable>은 롱프레스해도 부분 선택이 안 되고 Text 전체가 복사된다
 *    (RCTParagraphComponentView.mm의 copy:). 읽기 전용 multiline TextInput은 UITextView가
 *    백킹이라 드래그 핸들로 구간을 고를 수 있다(실기기 확인, #268).
 *  - Android: 읽기 전용 TextInput은 editable=false가 EditText.isEnabled=false로 매핑돼
 *    (ReactTextInputManager.kt) 롱프레스 자체가 먹지 않는다. <Text selectable>이 핸들·음영·
 *    부분 선택을 기본 제공한다(실기기 피드백, #283).
 * 그래서 각 플랫폼이 잘하는 쪽을 쓴다.
 */
const SelectableText = ({ text, style }: Props) =>
  Platform.OS === 'android' ? (
    <Text selectable style={style}>
      {text}
    </Text>
  ) : (
    <TextInput
      style={[styles.reset, style]}
      value={text}
      editable={false}
      multiline
      scrollEnabled={false}
    />
  );

const styles = StyleSheet.create({
  // TextInput은 자체 패딩이 있어 Text와 같은 자리에 놓이도록 0으로 지운다.
  reset: {
    padding: 0,
  },
});

export default SelectableText;
