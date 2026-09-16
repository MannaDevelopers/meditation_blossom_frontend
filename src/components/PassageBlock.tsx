import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SelectableText from './SelectableText';
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
 * 본문은 플랫폼별 선택 방식을 가진 SelectableText로 그린다(이유는 그 파일 참고).
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
      <SelectableText text={passage.content} style={styles.body} />
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
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: 'Pretendard-Bold',
      lineHeight: 24,
    },
  });

export default PassageBlock;
