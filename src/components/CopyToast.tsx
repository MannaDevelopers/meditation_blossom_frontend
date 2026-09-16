import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemeColors } from '../theme/colors';

/** 토스트가 컨테이너 바닥에서 떨어진 거리. Android에서는 여기에 내비 바 inset이 더해진다. */
const TOAST_BOTTOM_MARGIN = 24;

interface Props {
  /** 표시할 문구. null이면 숨긴다. */
  message: string | null;
}

/**
 * 복사 완료 피드백([#166]).
 * Alert은 확인을 눌러야 사라져 복사처럼 가벼운 동작에는 과하다. 잠깐 떴다 사라지는
 * 알약으로 둔다. 사라지는 시점은 부모가 message를 null로 되돌려 정한다.
 */
const CopyToast = ({ message }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // 묵상 시트·FAB와 같은 이유로 Android에서만 시스템 내비게이션 바 위로 올린다([#283],
  // MeditationNoteSheet.tsx의 navBarInset 주석 참고).
  const insets = useSafeAreaInsets();
  const navBarInset = Platform.OS === 'android' ? insets.bottom : 0;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: message ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [message, opacity]);

  // 사라지는 애니메이션이 끝나기 전에 언마운트되지 않도록 문구가 없어도 렌더는 유지한다.
  return (
    <Animated.View
      style={[styles.toast, { opacity, bottom: TOAST_BOTTOM_MARGIN + navBarInset }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{message ?? ''}</Text>
    </Animated.View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: colors.textSecondary,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    text: {
      color: colors.surface,
      fontSize: 14,
      fontFamily: 'Pretendard-Medium',
    },
  });

export default CopyToast;
