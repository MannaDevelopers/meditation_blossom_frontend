import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemeColors } from '../theme/colors';
import Clipboard from '@react-native-clipboard/clipboard';
import SvgIcon from './SvgIcon';
import { MEDITATION_NOTE_MAX_LENGTH } from '../constants';
import {
  clearMeditationNote,
  loadMeditationNote,
  MeditationNoteSource,
  saveMeditationNote,
} from '../services/meditationNoteService';
import { formatMeditationNoteForCopy, hasCopyableNote } from '../utils/meditationNote';
import logger from '../utils/logger';

/** 입력 중 매 글자마다 AsyncStorage를 때리지 않도록 묶어서 저장하는 간격 */
const SAVE_DEBOUNCE_MS = 600;
/** 복사 완료 문구가 떠 있는 시간 */
const COPIED_TOAST_MS = 1800;
/** 이만큼 아래로 끌어내리면 시트를 닫는다 */
const DISMISS_DRAG_DISTANCE = 60;
/** 짧게 내려도 아래로 튕기는 속도면 닫는다 */
const DISMISS_DRAG_VELOCITY = 0.5;

interface Props {
  source: MeditationNoteSource;
  /**
   * 복사에 쓸 말씀 제목. processTitleText를 거치지 않은 원문(sermon.title / qt.title)을 넘긴다.
   * 말씀이 갱신되면 이 값만 바뀌고 사용자가 쓴 묵상은 유지된다([#174]).
   */
  title: string | undefined;
}

const MeditationNoteSheet = ({ source, title }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 아래로 끌어내린 거리. 손가락을 따라 시트가 내려가게 한다. */
  const dragY = useRef(new Animated.Value(0)).current;
  // 디바운스 타이머가 아직 안 터진 상태로 시트를 닫거나 언마운트될 때 마지막 입력을 잃지 않도록
  // 최신 값을 ref로도 들고 있는다(state는 cleanup 시점에 stale일 수 있음).
  const latestNote = useRef('');

  // 로드가 늦게 도착하는 사이 사용자가 이미 타이핑을 시작했으면 덮어쓰지 않는다.
  const hasTypedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    loadMeditationNote(source).then(saved => {
      if (cancelled || hasTypedRef.current) return;
      setNote(saved);
      latestNote.current = saved;
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // 시트가 화면 하단에 absolute로 붙어 있어 키보드가 그대로 덮는다.
  // KeyboardAvoidingView는 absolute 자식에 잘 먹지 않아 bottom을 직접 밀어 올린다.
  //
  // 얼마나 밀어야 하는지가 플랫폼 하나로 갈리지 않는다:
  //  - iOS: 창이 줄지 않는다 → 키보드 높이만큼 전부 밀어야 한다.
  //  - Android + windowSoftInputMode="adjustResize"(AndroidManifest.xml:28): 창이 줄어들어
  //    하단 absolute 요소가 이미 올라온다 → 또 밀면 이중 보정으로 시트가 화면 중간에 뜬다.
  //  - Android 15/16: targetSdk 36(android/build.gradle.kts)이라 RN이 edge-to-edge를 강제로
  //    켜면서(WindowUtil.updateEdgeToEdgeFeatureFlag) 창이 줄지 않는다 → iOS처럼 밀어야 한다.
  //
  // 즉 Platform.OS로 나누면 어느 한쪽 Android 세대가 반드시 깨진다. 그래서 분기 대신
  // "창이 실제로 줄어든 양"을 재서 그만큼을 빼고 남은 만큼만 민다. 어느 조합이든 성립한다.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 부모(화면 컨테이너)의 실제 레이아웃 높이. 창이 줄면 같이 줄어든다.
  const [viewportHeight, setViewportHeight] = useState(0);
  const maxViewportHeight = useRef(0);
  const handleProbeLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    maxViewportHeight.current = Math.max(maxViewportHeight.current, h);
    setViewportHeight(h);
  };

  const windowShrink =
    maxViewportHeight.current > 0 && viewportHeight > 0
      ? Math.max(0, maxViewportHeight.current - viewportHeight)
      : 0;
  const keyboardOffset = Math.max(0, keyboardHeight - windowShrink);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveMeditationNote(source, latestNote.current);
  }, [source]);

  // 앱이 종료돼도 작성 내용이 남아야 하므로(기획 요구사항) 언마운트 시 대기 중인 저장을 흘려보낸다.
  useEffect(() => flushSave, [flushSave]);

  // 언마운트만으로는 부족하다. 사용자가 홈으로 나가면 언마운트가 일어나지 않고, OS가 그 상태에서
  // 앱을 정리하면 디바운스 대기 중이던 최대 600ms 분량이 그대로 사라진다.
  // 백그라운드 전환 시점에 한 번 더 흘려보낸다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') flushSave();
    });
    return () => sub.remove();
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleChangeText = (text: string) => {
    hasTypedRef.current = true;
    setNote(text);
    latestNote.current = text;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveMeditationNote(source, text);
    }, SAVE_DEBOUNCE_MS);
  };

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    flushSave();
    dragY.setValue(0);
    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current);
      copiedTimer.current = null;
    }
    setCopied(false);
    setIsOpen(false);
  }, [flushSave, dragY]);

  // Android 하드웨어 뒤로가기로 시트를 닫는다.
  // 등록 조건이 두 가지인 이유:
  //  - isOpen: 시트가 닫혀 있을 때 true를 반환하면 앱 전체의 뒤로가기가 막힌다.
  //  - isFocused: 두 탭 화면이 동시에 마운트돼 있어 시트 인스턴스도 둘이다. 리스너는 역순
  //    (LIFO)으로 호출되므로(BackHandler.android.js), 게이트가 없으면 화면에 보이지도 않는
  //    반대 탭의 시트가 뒤로가기를 삼켜 "눌러도 아무 일이 없는" 상태가 된다.
  // 핸들러 안에서 분기하지 않고 등록 자체를 조건부로 두어 리스너 목록을 깨끗하게 유지한다.
  //
  // 참고: 이 경로는 AndroidManifest에 android:enableOnBackInvokedCallback이 없어서
  // 레거시 onBackPressed로 동작한다. 나중에 그 플래그를 켜면(RN 0.86은 아직 예측형 뒤로가기를
  // 지원하지 않는다) 여기도 같이 손봐야 한다.
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, isFocused, closeSheet]);

  // PanResponder는 한 번만 만들어져 최초 렌더의 closeSheet를 붙잡는다.
  // ref로 최신 콜백을 가리켜 stale closure를 피한다.
  const closeSheetRef = useRef(closeSheet);
  closeSheetRef.current = closeSheet;

  // 헤더(그래버 + 제목)에서만 아래로 끌어 닫는다. 시트 전체에 붙이면
  // 본문 TextInput의 터치·커서 이동을 가로챈다.
  const dragResponder = useRef(
    PanResponder.create({
      // 아래 방향 세로 드래그일 때만 가져간다. 가로 제스처(탭 전환)는 건드리지 않는다.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        // 위로는 따라오지 않게 해서 시트가 화면 밖으로 솟는 것을 막는다.
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DRAG_DISTANCE || g.vy > DISMISS_DRAG_VELOCITY) {
          closeSheetRef.current();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  const handleCopy = () => {
    if (!hasCopyableNote(note)) return;
    Clipboard.setString(formatMeditationNoteForCopy(title, note));
    flushSave();
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_TOAST_MS);
    logger.log(`[MeditationNote] copied (${source})`);
  };

  const handleClearAll = () => {
    if (!note) return;
    Alert.alert('전체 지우기', '작성한 내용을 전부 지우려면 확인을 눌러주세요', [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        style: 'destructive',
        onPress: () => {
          if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
          }
          setNote('');
          latestNote.current = '';
          clearMeditationNote(source);
        },
      },
    ]);
  };

  if (!isOpen) {
    return (
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsOpen(true)}
        accessibilityLabel="묵상 작성"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {/* SVG가 자체 터치 responder가 되어 탭을 삼키는 문제(ISSUE-138 패턴) 회피 */}
        <SvgIcon name="EditPencil" size={24} fill={FAB_ICON_COLOR} pointerEvents="none" />
      </TouchableOpacity>
    );
  }

  const canCopy = hasCopyableNote(note);

  return (
    <>
      {/* 창이 실제로 줄어든 양을 재기 위한 측정용 뷰. pointerEvents="none"이라 터치에 관여하지
          않는다. Android adjustResize/edge-to-edge 조합을 런타임에 구분하는 유일한 수단이다. */}
      <View style={styles.viewportProbe} pointerEvents="none" onLayout={handleProbeLayout} />
      {/* 시트 바깥을 덮는 탭-닫기 오버레이는 두지 않는다. 실기 확인 결과(iPhone 17 Pro,
          iOS 26.3) 그 오버레이가 터치를 가져가면서 뒤 ScrollView가 스크롤되지 않았고,
          이는 "시트가 떠 있어도 말씀 영역 스크롤이 가능해야 한다"는 기획 요구사항과
          정면으로 충돌한다. 닫기는 그래버 탭 또는 헤더를 아래로 끌어내리기로 한다. */}
      <Animated.View
        style={[
          styles.sheet,
          { bottom: keyboardOffset, transform: [{ translateY: dragY }] },
        ]}
      >
        {/* 헤더를 아래로 끌어내리거나 그래버를 탭하면 닫힌다.
            드래그를 헤더에만 붙이는 이유는 시트 전체에 붙이면 본문 TextInput의
            터치·커서 이동까지 가로채기 때문이다. */}
        <View {...dragResponder.panHandlers}>
          <Pressable
            onPress={closeSheet}
            style={styles.grabberArea}
            accessibilityLabel="묵상 입력창 닫기"
            accessibilityRole="button"
          >
            <View style={styles.grabber} />
          </Pressable>

          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {title || '말씀을 불러오는 중입니다'}
            </Text>
            {/* 헤더 드래그로 닫기는 Android에서 ViewPager2의 NestedScrollableHost가 제스처를
                취소해 동작하지 않는 것을 실기(Pixel 6 / API 35)에서 확인했다. 제스처에 의존하지
                않는 닫기 수단을 명시적으로 둔다. */}
            <TouchableOpacity
              onPress={closeSheet}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="묵상 입력창 닫기"
              accessibilityRole="button"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.sheetDivider} />

        <TextInput
          style={styles.input}
          value={note}
          onChangeText={handleChangeText}
          placeholder={'오늘의 묵상을 입력하세요\n(예: 본문에서 받은 은혜, 나의 고백…)'}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={MEDITATION_NOTE_MAX_LENGTH}
          textAlignVertical="top"
        />

        <Text style={styles.counter}>
          {note.length} / {MEDITATION_NOTE_MAX_LENGTH}
        </Text>

        <View style={styles.actionDivider} />
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleClearAll} disabled={!note} hitSlop={12}>
            <Text style={[styles.clearText, !note && styles.disabledText]}>전체 지우기</Text>
          </TouchableOpacity>
          <View style={styles.actionRight}>
            {copied ? <Text style={styles.copiedText}>복사했어요</Text> : null}
            <TouchableOpacity
              style={[styles.copyButton, !canCopy && styles.copyButtonDisabled]}
              onPress={handleCopy}
              disabled={!canCopy}
            >
              <Text style={styles.copyButtonText}>복사</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
};

// accent(#00A8DE)는 라이트/다크에서 동일해서, 그 위에 얹는 아이콘·라벨은 두 테마 모두
// 흰색이 대비를 만족한다. 테마 토큰으로 뺄 필요가 없어 상수로 둔다.
const FAB_ICON_COLOR = '#FFFFFF';

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 0, // 부모 컨테이너가 이미 marginHorizontal 27을 가지므로 화면 우측에서 27
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // 본문 위에 떠 있으므로 스크롤되는 텍스트와 구분되도록 그림자를 준다.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  viewportProbe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 1,
  },
  sheet: {
    position: 'absolute',
    // 부모 컨테이너의 marginHorizontal 27을 상쇄해 시트만 화면 폭까지 넓힌다.
    left: -27,
    right: -27,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 27,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  grabberArea: {
    alignItems: 'center',
    // 헤더 드래그가 Android ViewPager2에 취소될 수 있어(NestedScrollableHost) 탭이 확실한
    // 닫기 수단이 되어야 한다. 애플 최소 터치 영역 44pt를 만족시킨다.
    paddingVertical: 20,
  },
  grabber: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sheetTitle: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  closeButton: {
    paddingHorizontal: 4,
  },
  closeIcon: {
    color: colors.textTertiary,
    fontSize: 18,
    lineHeight: 22,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  input: {
    minHeight: 88,
    maxHeight: 160,
    paddingTop: 12,
    paddingHorizontal: 0,
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 22,
  },
  counter: {
    alignSelf: 'flex-end',
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 8,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  disabledText: {
    opacity: 0.4,
  },
  copiedText: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  copyButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  copyButtonDisabled: {
    // 별도 색을 두면 테마마다 대비를 다시 맞춰야 해서 불투명도로 처리한다.
    opacity: 0.4,
  },
  copyButtonText: {
    color: FAB_ICON_COLOR,
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
  },
  });

export default MeditationNoteSheet;
