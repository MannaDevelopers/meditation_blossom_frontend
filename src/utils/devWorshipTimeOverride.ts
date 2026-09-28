import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEV_WORSHIP_TIME_OVERRIDE_KEY } from '../constants';
import logger from './logger';

/**
 * __DEV__ 전용 QA 도구: 히든 개발자 메뉴(SettingsScreen)에서 설정한 가상 시각을 읽는다
 * ([ISSUE-315]). 기기 시계를 건드리지 않고도 예배시간 경계를 자유롭게 시뮬레이션하기 위함 —
 * 프로덕션 빌드에서는 항상 null을 반환해 실제 현재 시각만 쓰이게 한다.
 */
export async function getDevWorshipTimeOverride(): Promise<Date | null> {
  if (!__DEV__) return null;
  try {
    const raw = await AsyncStorage.getItem(DEV_WORSHIP_TIME_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (e) {
    logger.warn('getDevWorshipTimeOverride: 읽기 실패', e);
    return null;
  }
}

/** 가상 시각을 저장(date)하거나 해제(null)한다. __DEV__가 아니면 아무 것도 하지 않는다. */
export async function setDevWorshipTimeOverride(date: Date | null): Promise<void> {
  if (!__DEV__) return;
  if (date) {
    await AsyncStorage.setItem(DEV_WORSHIP_TIME_OVERRIDE_KEY, date.toISOString());
  } else {
    await AsyncStorage.removeItem(DEV_WORSHIP_TIME_OVERRIDE_KEY);
  }
}

/**
 * 예배시간 게이팅 판별에 쓸 "지금"을 반환한다. __DEV__에서 가상 시각이 설정돼 있으면
 * 그 값을, 아니면 실제 현재 시각을 반환한다. hasWorshipTimeArrived를 호출하는 모든
 * 지점(sermonService/useSermonData/useFCMListener)이 이 함수를 거쳐야 오버라이드가 먹힌다.
 */
export async function getEffectiveNow(): Promise<Date> {
  const override = await getDevWorshipTimeOverride();
  return override ?? new Date();
}
