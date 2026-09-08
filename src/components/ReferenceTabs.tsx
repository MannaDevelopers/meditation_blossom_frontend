import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemeColors } from '../theme/colors';

interface Props {
  labels: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * 참조가 많을 때 쓰는 텍스트형 선택 탭([#173]).
 *
 * 기존 장절 표시("열왕기하 22:2, 열왕기하 23:21-25")와 같은 자리·같은 스타일의 콤마 구분
 * 한 줄이고, 선택된 것만 굵은 본문색 / 나머지는 보통 굵기 흐린색이다.
 *
 * 좌우 스와이프를 넣지 않기로 했으므로 이 탭이 참조 간 **유일한 이동 수단**이다.
 * 그래서 화면에서 스크롤로 사라지면 안 되고, 부모 ScrollView가 stickyHeaderIndices로
 * 이 행을 고정한다 — 고정이 성립하려면 이 컴포넌트가 ScrollView의 직속 자식이어야 하고
 * 불투명한 배경과 고정 높이를 가져야 한다.
 */
const ReferenceTabs = ({ labels, selectedIndex, onSelect }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  // 각 탭의 x 위치. 선택된 탭이 화면 밖에 있으면 가로로 끌어와 보여준다.
  const offsets = useRef<number[]>([]);

  const revealSelected = (index: number) => {
    const x = offsets.current[index];
    if (x === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  };

  return (
    <View style={styles.row}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {labels.map((label, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={`${label}-${index}`}
              onPress={() => {
                onSelect(index);
                revealSelected(index);
              }}
              onLayout={e => {
                offsets.current[index] = e.nativeEvent.layout.x;
              }}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {label}
                {index < labels.length - 1 ? ',' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      // sticky로 고정되는 행이라 배경이 불투명해야 아래 본문이 비쳐 보이지 않는다.
      backgroundColor: colors.background,
      height: 34,
      justifyContent: 'center',
    },
    content: {
      alignItems: 'center',
      gap: 6,
      paddingRight: 8,
    },
    label: {
      fontSize: 16,
      fontFamily: 'Pretendard-Regular',
      color: colors.textMuted,
    },
    labelSelected: {
      fontFamily: 'Pretendard-Bold',
      color: colors.textPrimary,
    },
  });

export default ReferenceTabs;
