import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SvgIcon from './SvgIcon';
import { useAppTheme } from '../hooks/useAppTheme';
import { ScripturePassage } from '../services/scriptureService';
import { ThemeColors } from '../theme/colors';

interface Props {
  passage: ScripturePassage;
  /** 참조가 하나뿐이거나 페이지 모드면 라벨을 칩으로 보여줄지 결정한다 */
  showChip?: boolean;
  onCopy?: () => void;
}

/**
 * 참조 하나를 그리는 블록 — 칩(장절 라벨) + 복사 버튼 + 본문([#173], [#166]).
 *
 * 본문을 Text가 아니라 읽기 전용 TextInput으로 그리는 이유:
 * iOS의 <Text selectable>은 롱프레스해도 부분 선택이 되지 않고 Text 전체가 복사된다
 * (RCTParagraphComponentView.mm의 copy:가 NSMakeRange(0, length)를 쓴다).
 * multiline TextInput은 UITextView가 백킹이라 드래그 핸들로 원하는 구간만 고를 수 있다.
 * iPhone 17 Pro에서 두 방식을 나란히 놓고 확인했다.
 */
const PassageBlock = ({ passage, showChip = true, onCopy }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.block}>
      {showChip && passage.label ? (
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{passage.label}</Text>
          </View>
          {onCopy ? (
            <TouchableOpacity
              onPress={onCopy}
              style={styles.copyButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={`${passage.label} 복사`}
              accessibilityRole="button"
            >
              {/* SVG가 자체 터치 responder가 되어 탭을 삼키는 문제(ISSUE-138 패턴) 회피 */}
              <SvgIcon name="CopyIcon" size={18} fill={colors.textTertiary} pointerEvents="none" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <TextInput
        style={styles.body}
        value={passage.content}
        editable={false}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    block: {
      marginBottom: 32,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    chip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.infoPanelBlue,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    chipText: {
      color: colors.accent,
      fontSize: 13,
      fontFamily: 'Pretendard-Medium',
    },
    copyButton: {
      padding: 2,
    },
    body: {
      // 기존 본문(contentText)과 같은 타이포. TextInput은 자체 패딩이 있어 0으로 지운다.
      padding: 0,
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: 'Pretendard-Bold',
      lineHeight: 24,
    },
  });

export default PassageBlock;
