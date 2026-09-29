import { getAnalytics, logEvent as firebaseLogEvent, setUserProperty } from '@react-native-firebase/analytics';
import { WorshipSetting } from '../types/Sermon';
import logger from './logger';

function logEvent(name: string, params?: Record<string, string>): void {
  firebaseLogEvent(getAnalytics(), name, params ?? {})
    .catch(e => logger.warn(`analytics.logEvent(${name}) failed`, e));
}

export const logAnalytics = {
  // 탭 전환: 주일 말씀 ↔ 매일 만나
  tabSwitch: (tab: 'sunday_sermon' | 'daily_qt') =>
    logEvent('tab_switch', { tab }),

  // YouTube 버튼 클릭
  youtubeClick: (screen: 'home' | 'daily_manna') =>
    logEvent('youtube_click', { screen }),

  // 본문 끝까지 스크롤 (세션당 1회)
  scrollComplete: (screen: 'home' | 'daily_manna') =>
    logEvent('scroll_complete', { screen }),

  // 위젯 클릭 대상 변경 (메인 앱 화면 / 유튜브 링크)
  widgetOptionChange: (option: 'main_app' | 'youtube_link') =>
    logEvent('widget_option_change', { option }),

  // 데이터 새로고침 버튼 클릭
  dataRefresh: () =>
    logEvent('data_refresh'),

  // 서버/로컬 데이터 로드 실패
  dataLoadFailed: (type: 'sermon' | 'qt') =>
    logEvent('data_load_failed', { type }),

  // 앱 실행 시 데이터 소스 (cache = AsyncStorage 신선, firestore = 서버 재요청, none = 데이터 없음)
  appDataSource: (source: 'cache' | 'firestore' | 'none', type: 'sermon' | 'qt') =>
    logEvent('app_data_source', { source, type }),

  // 예배 시간 설정 변경
  worshipSettingChange: (setting: WorshipSetting) =>
    logEvent('worship_setting_change', { setting }),

  // 위젯 디자인 저장 (EditScreen)
  widgetDesignSave: (source: 'sermon' | 'qt') =>
    logEvent('widget_design_save', { source }),

  // 묵상 작성 시작 (세션당 1회, 빈 칸 → 입력 시작 시점)
  meditationNoteStarted: (source: 'sermon' | 'qt') =>
    logEvent('meditation_note_started', { source }),

  // 묵상 공유 버튼 클릭
  meditationShare: (source: 'sermon' | 'qt') =>
    logEvent('meditation_share', { source }),

  // 기본 화면 설정 변경
  defaultScreenChange: (tab: 'sunday_sermon' | 'daily_qt') =>
    logEvent('default_screen_change', { tab }),

  // 말씀/묵상 질문 복사
  contentCopy: (screen: 'home' | 'daily_manna', type: 'passage' | 'all' | 'questions') =>
    logEvent('content_copy', { screen, type }),

  // 위젯 클릭 대상 User Property (기기당 현재 설정값 — Firebase Audiences에서 분포 확인용)
  setWidgetLinkTarget: (value: 'main_app' | 'youtube_link') =>
    setUserProperty(getAnalytics(), 'widget_link_target', value)
      .catch(e => logger.warn('analytics.setUserProperty(widget_link_target) failed', e)),

  // 예배 시간 설정 User Property
  setWorshipSetting: (value: WorshipSetting) =>
    setUserProperty(getAnalytics(), 'worship_setting', value)
      .catch(e => logger.warn('analytics.setUserProperty(worship_setting) failed', e)),

  // 기기 테마(다크모드) User Property
  setDeviceTheme: (value: 'light' | 'dark') =>
    setUserProperty(getAnalytics(), 'device_theme', value)
      .catch(e => logger.warn('analytics.setUserProperty(device_theme) failed', e)),
};
