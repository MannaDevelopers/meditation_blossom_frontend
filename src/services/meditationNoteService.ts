import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MEDITATION_NOTE_IDENTITY_STORAGE_KEY_QT,
  MEDITATION_NOTE_IDENTITY_STORAGE_KEY_SERMON,
  MEDITATION_NOTE_STORAGE_KEY_QT,
  MEDITATION_NOTE_STORAGE_KEY_SERMON,
} from '../constants';
import { NoteIdentity } from '../utils/meditationNoteGuard';
import logger from '../utils/logger';

/** 묵상 메모는 탭별로 하나씩 유지한다([#174]) */
export type MeditationNoteSource = 'sermon' | 'qt';

const STORAGE_KEY: Record<MeditationNoteSource, string> = {
  sermon: MEDITATION_NOTE_STORAGE_KEY_SERMON,
  qt: MEDITATION_NOTE_STORAGE_KEY_QT,
};

const IDENTITY_STORAGE_KEY: Record<MeditationNoteSource, string> = {
  sermon: MEDITATION_NOTE_IDENTITY_STORAGE_KEY_SERMON,
  qt: MEDITATION_NOTE_IDENTITY_STORAGE_KEY_QT,
};

/**
 * 저장된 묵상 메모를 읽는다. 없거나 읽기에 실패하면 빈 문자열.
 * 메모는 평문 문자열이라 JSON 파싱이 없고, 따라서 손상 데이터로 반복 실패할 여지가 없다.
 */
export async function loadMeditationNote(source: MeditationNoteSource): Promise<string> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY[source])) ?? '';
  } catch (e) {
    logger.error(`loadMeditationNote(${source}) 실패`, e);
    return '';
  }
}

export async function saveMeditationNote(
  source: MeditationNoteSource,
  note: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY[source], note);
  } catch (e) {
    // 저장 실패를 조용히 삼키면 사용자가 쓴 글이 사라진 것을 모른 채 앱을 닫는다.
    // 화면에서 되돌릴 방법이 없으므로 최소한 Crashlytics에는 남긴다.
    logger.error(`saveMeditationNote(${source}) 실패`, e);
  }
}

export async function clearMeditationNote(source: MeditationNoteSource): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY[source]);
  } catch (e) {
    logger.error(`clearMeditationNote(${source}) 실패`, e);
  }
}

/**
 * 마지막으로 묵상을 작성/판단한 시점의 말씀 식별자(sermonNoteIdentity/qtNoteIdentity).
 * 다음에 새 말씀이 들어왔는지 비교하는 기준선으로 쓰인다.
 */
export async function loadNoteIdentity(
  source: MeditationNoteSource,
): Promise<NoteIdentity | null> {
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_STORAGE_KEY[source]);
    return raw ? (JSON.parse(raw) as NoteIdentity) : null;
  } catch (e) {
    logger.error(`loadNoteIdentity(${source}) 실패`, e);
    return null;
  }
}

export async function saveNoteIdentity(
  source: MeditationNoteSource,
  identity: NoteIdentity,
): Promise<void> {
  try {
    await AsyncStorage.setItem(IDENTITY_STORAGE_KEY[source], JSON.stringify(identity));
  } catch (e) {
    logger.error(`saveNoteIdentity(${source}) 실패`, e);
  }
}
