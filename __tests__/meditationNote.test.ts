import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MEDITATION_NOTE_STORAGE_KEY_QT,
  MEDITATION_NOTE_STORAGE_KEY_SERMON,
} from '../src/constants';
import {
  clearMeditationNote,
  loadMeditationNote,
  saveMeditationNote,
} from '../src/services/meditationNoteService';
import {
  formatMeditationNoteForCopy,
  hasCopyableNote,
} from '../src/utils/meditationNote';

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('formatMeditationNoteForCopy', () => {
  it('제목과 묵상을 두 줄로 이어붙인다', () => {
    expect(
      formatMeditationNoteForCopy('179 하나님의 음성을 구별하라', '하나님의 성품을 더 알고 싶습니다.'),
    ).toBe('179 하나님의 음성을 구별하라\n하나님의 성품을 더 알고 싶습니다.');
  });

  it('제목이 갱신되면 갱신된 제목으로 복사된다 (묵상은 그대로)', () => {
    const note = '하나님의 성품을 더 알고 싶습니다.';
    expect(formatMeditationNoteForCopy('179 하나님의 음성을 구별하라', note)).toBe(
      '179 하나님의 음성을 구별하라\n' + note,
    );
    expect(
      formatMeditationNoteForCopy('180 우리도 양처럼 목자의 음성을 들을 수 있다', note),
    ).toBe('180 우리도 양처럼 목자의 음성을 들을 수 있다\n' + note);
  });

  it('제목이 없으면 묵상만 복사한다 (빈 줄을 남기지 않음)', () => {
    expect(formatMeditationNoteForCopy(undefined, '오늘 묵상 하였습니다')).toBe(
      '오늘 묵상 하였습니다',
    );
    expect(formatMeditationNoteForCopy(null, '오늘 묵상 하였습니다')).toBe(
      '오늘 묵상 하였습니다',
    );
  });

  it('앞뒤 공백과 개행을 정리한다', () => {
    expect(formatMeditationNoteForCopy('  제목  ', '\n\n  내용  \n')).toBe('제목\n내용');
  });

  it('둘 다 비면 빈 문자열', () => {
    expect(formatMeditationNoteForCopy('', '   ')).toBe('');
  });
});

describe('hasCopyableNote', () => {
  it('공백만 있으면 복사 대상이 아니다', () => {
    expect(hasCopyableNote('')).toBe(false);
    expect(hasCopyableNote('   \n  ')).toBe(false);
  });

  it('내용이 있으면 복사 대상이다', () => {
    expect(hasCopyableNote('한 글자')).toBe(true);
  });
});

describe('meditationNoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('탭별로 다른 키를 쓴다 — 말씀과 QT 묵상이 섞이지 않는다', async () => {
    await saveMeditationNote('sermon', '주일 묵상');
    await saveMeditationNote('qt', '매일 묵상');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      MEDITATION_NOTE_STORAGE_KEY_SERMON,
      '주일 묵상',
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      MEDITATION_NOTE_STORAGE_KEY_QT,
      '매일 묵상',
    );
    expect(MEDITATION_NOTE_STORAGE_KEY_SERMON).not.toBe(MEDITATION_NOTE_STORAGE_KEY_QT);
  });

  it('저장된 값이 없으면 빈 문자열을 준다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await expect(loadMeditationNote('sermon')).resolves.toBe('');
  });

  it('저장된 값을 그대로 읽는다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('어제 쓴 묵상');
    await expect(loadMeditationNote('qt')).resolves.toBe('어제 쓴 묵상');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(MEDITATION_NOTE_STORAGE_KEY_QT);
  });

  it('읽기에 실패해도 빈 문자열로 떨어져 화면이 죽지 않는다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage down'));
    await expect(loadMeditationNote('sermon')).resolves.toBe('');
  });

  it('저장에 실패해도 예외를 밖으로 던지지 않는다', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage full'));
    await expect(saveMeditationNote('sermon', '내용')).resolves.toBeUndefined();
  });

  it('전체 지우기는 해당 탭 키만 지운다', async () => {
    await clearMeditationNote('qt');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(MEDITATION_NOTE_STORAGE_KEY_QT);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
      MEDITATION_NOTE_STORAGE_KEY_SERMON,
    );
  });
});
