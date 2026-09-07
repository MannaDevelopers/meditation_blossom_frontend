import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

interface Props {
  source: MeditationNoteSource;
  /**
   * 복사에 쓸 말씀 제목. processTitleText를 거치지 않은 원문(sermon.title / qt.title)을 넘긴다.
   * 말씀이 갱신되면 이 값만 바뀌고 사용자가 쓴 묵상은 유지된다([#174]).
   */
  title: string | undefined;
}

const MeditationNoteSheet = ({ source, title }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 디바운스 타이머가 아직 안 터진 상태로 시트를 닫거나 언마운트될 때 마지막 입력을 잃지 않도록
  // 최신 값을 ref로도 들고 있는다(state는 cleanup 시점에 stale일 수 있음).
  const latestNote = useRef('');

  useEffect(() => {
    loadMeditationNote(source).then(saved => {
      setNote(saved);
      latestNote.current = saved;
    });
  }, [source]);

  // 시트가 화면 하단에 absolute로 붙어 있어 키보드가 그대로 덮는다. KeyboardAvoidingView는
  // absolute 자식에 잘 먹지 않아, 키보드 높이를 직접 받아 bottom을 밀어 올린다.
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

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveMeditationNote(source, latestNote.current);
  }, [source]);

  // 앱이 강제 종료돼도 작성 내용이 남아야 하므로(기획 요구사항) 언마운트 시 대기 중인 저장을 흘려보낸다.
  useEffect(() => flushSave, [flushSave]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleChangeText = (text: string) => {
    setNote(text);
    latestNote.current = text;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveMeditationNote(source, text);
    }, SAVE_DEBOUNCE_MS);
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    flushSave();
    setIsOpen(false);
  };

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
        <SvgIcon name="EditPencil" size={24} fill="#FFFFFF" pointerEvents="none" />
      </TouchableOpacity>
    );
  }

  const canCopy = hasCopyableNote(note);

  return (
    <View style={[styles.sheet, { bottom: keyboardHeight }]}>
      {/* 그래버를 눌러 시트를 닫는다. 시트는 Modal이 아니라 absolute View라
          뒤쪽 말씀 영역은 열려 있는 동안에도 계속 스크롤된다(기획 요구사항). */}
      <Pressable
        onPress={closeSheet}
        style={styles.grabberArea}
        accessibilityLabel="묵상 입력창 닫기"
        accessibilityRole="button"
      >
        <View style={styles.grabber} />
      </Pressable>

      <Text style={styles.sheetTitle} numberOfLines={2}>
        {title || '말씀을 불러오는 중입니다'}
      </Text>
      <View style={styles.sheetDivider} />

      <TextInput
        style={styles.input}
        value={note}
        onChangeText={handleChangeText}
        placeholder={'오늘의 묵상을 입력하세요\n(예: 본문에서 받은 은혜, 나의 고백…)'}
        placeholderTextColor="#A59EAE"
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
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 0, // 부모 컨테이너가 이미 marginHorizontal 27을 가지므로 화면 우측에서 27
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00A8DE',
    alignItems: 'center',
    justifyContent: 'center',
    // 본문 위에 떠 있으므로 스크롤되는 텍스트와 구분되도록 그림자를 준다.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  sheet: {
    position: 'absolute',
    // 부모 컨테이너의 marginHorizontal 27을 상쇄해 시트만 화면 폭까지 넓힌다.
    left: -27,
    right: -27,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 27,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  grabberArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabber: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  sheetTitle: {
    color: '#747474',
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    marginBottom: 8,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  input: {
    minHeight: 88,
    maxHeight: 160,
    paddingTop: 12,
    paddingHorizontal: 0,
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 22,
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#A59EAE',
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    marginBottom: 8,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
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
    color: '#A59EAE',
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
  },
  disabledText: {
    opacity: 0.4,
  },
  copiedText: {
    color: '#00A8DE',
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
  },
  copyButton: {
    backgroundColor: '#00A8DE',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  copyButtonDisabled: {
    backgroundColor: '#C9E9F4',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
  },
});

export default MeditationNoteSheet;
