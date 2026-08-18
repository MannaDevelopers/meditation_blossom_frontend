import { WidgetTextWeight } from '../types/WidgetDesign';

/** Interval (ms) for polling iOS App Group data for background FCM updates */
export const APP_GROUP_POLL_INTERVAL_MS = 5000;
/** Workaround delay (ms) for iOS native bridge not being ready immediately after app launch */
export const BRIDGE_INIT_DELAY_MS = 100;
/** Days after which local sermon data is considered stale and re-fetched from server */
export const STALE_DATA_THRESHOLD_DAYS = 7;
/** UserDefaults / App Group key for the currently displayed sermon */
export const APP_GROUP_DISPLAY_SERMON_KEY = 'displaySermon';
// 위젯 디자인은 네이티브(Android SharedPreferences/WidgetDesignRepository)에만 저장되고 RN
// 쪽에는 캐시가 없어서, 저장 후 편집 화면을 나갔다가 다시 들어오면 항상 기본값부터 시작했다.
// Sermon 콘텐츠가 이미 쓰는 AsyncStorage 캐시 패턴(FCM_SERMON_KEY)과 동일하게, EditScreen이
// 저장 시점에 여기 같이 캐시해두고 진입 시 불러온다.
export const WIDGET_DESIGN_STORAGE_KEY = 'widget_design';

// 위젯 디자인 편집 - 텍스트 색상 스와치 프리셋 (빨강/주황/노랑/초록/파랑/흰색/검정)
// 8번째 "사용자 지정" 스와치는 프리셋이 아닌 커스텀 컬러피커 진입 버튼이라 이 배열에는 포함하지 않음
export const WIDGET_TEXT_COLOR_PRESETS: readonly string[] = [
  '#FF3B30', // 빨강
  '#FF9500', // 주황
  '#FFCC00', // 노랑
  '#34C759', // 초록
  '#007AFF', // 파랑
  '#FFFFFF', // 흰색
  '#000000', // 검정
];

// 위젯 디자인 편집 - 배경색 스와치 프리셋 (화이트/라이트옐로우/라이트그린/라이트블루/라이트핑크/베이지/다크그레이)
// 8번째 "사용자 지정" 스와치는 위와 동일하게 이 배열에 포함하지 않음
export const WIDGET_BACKGROUND_COLOR_PRESETS: readonly string[] = [
  '#FFFFFF', // 화이트
  '#FFF9DB', // 라이트옐로우
  '#E3F9E5', // 라이트그린
  '#E3F2FD', // 라이트블루
  '#FDE3EC', // 라이트핑크
  '#F5E9DA', // 베이지
  '#2E2E2E', // 다크그레이
];

// 위젯 디자인 편집 - 텍스트 두께(WidgetTextWeight) → 실제 렌더링에 쓰는 Pretendard 폰트 패밀리
export const WIDGET_TEXT_WEIGHT_FONT_FAMILY: Record<WidgetTextWeight, string> = {
  regular: 'Pretendard-Regular',
  bold: 'Pretendard-Bold',
  extrabold: 'Pretendard-ExtraBold',
};
