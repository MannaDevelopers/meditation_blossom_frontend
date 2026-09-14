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

  // [#174] 기획에서 유일하게 까다로웠던 규칙 — 8/3에 쓴 묵상을 8/4에 복사하면
  // 8/4 제목과 짝지어져야 한다. 회귀하면 사용자가 바로 알아챈다.
  it('말씀이 갱신되면 갱신된 제목으로 복사되고 묵상은 유지된다', () => {
    const note = '하나님의 성품을 더 알고 싶습니다.';
    expect(formatMeditationNoteForCopy('179 하나님의 음성을 구별하라', note)).toBe(
      '179 하나님의 음성을 구별하라\n' + note,
    );
    expect(
      formatMeditationNoteForCopy('180 우리도 양처럼 목자의 음성을 들을 수 있다', note),
    ).toBe('180 우리도 양처럼 목자의 음성을 들을 수 있다\n' + note);
  });

  // 말씀 로딩 전에 복사하면 제목 자리에 빈 줄이 딸려가던 실제 버그를 막는다.
  it('제목이 없으면 빈 줄 없이 묵상만 복사한다', () => {
    expect(formatMeditationNoteForCopy(undefined, '오늘 묵상 하였습니다')).toBe(
      '오늘 묵상 하였습니다',
    );
  });
});

describe('hasCopyableNote', () => {
  // 묵상을 안 썼는데 복사를 누르면 제목만 클립보드에 들어가는 것을 막는 가드.
  it('공백만 있으면 복사 대상이 아니다', () => {
    expect(hasCopyableNote('   \n  ')).toBe(false);
    expect(hasCopyableNote('한 글자')).toBe(true);
  });
});

describe('meditationNoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 이 설계의 핵심 불변식. 깨지면 주일 말씀 묵상이 매일 만나 탭에 나타난다.
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

  it('읽기에 실패해도 빈 문자열로 떨어져 화면이 죽지 않는다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage down'));
    await expect(loadMeditationNote('sermon')).resolves.toBe('');
  });

  it('저장에 실패해도 예외를 밖으로 던지지 않는다', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage full'));
    await expect(saveMeditationNote('sermon', '내용')).resolves.toBeUndefined();
  });

  // 삭제는 되돌릴 수 없으므로 대상 키를 정확히 고정해둔다.
  it('전체 지우기는 해당 탭 키만 지운다', async () => {
    await clearMeditationNote('qt');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(MEDITATION_NOTE_STORAGE_KEY_QT);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
      MEDITATION_NOTE_STORAGE_KEY_SERMON,
    );
  });
});
