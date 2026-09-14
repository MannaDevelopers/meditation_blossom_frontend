import { Platform } from 'react-native';

// Android 네이티브(WidgetDesignPrefsDataSource.kt)가 갤러리 배경의 영구 저장 경로를 스킴 없는
// 순수 절대 경로(예: /data/user/0/.../widget_design_background_sermon.jpg)로 돌려준다 — 이 형식은
// Glance 위젯의 BitmapFactory.decodeFile()에는 맞지만, RN <Image>(Android, Fresco)는 "://" 스킴이
// 없는 문자열을 로컬 파일이 아니라 drawable 리소스 이름으로 해석해 로드에 실패한다([ISSUE-254]:
// 편집 화면 재진입 시 배경 미리보기가 검정 화면으로 깨짐). iOS는 스킴 없는 절대 경로도 로컬 파일로
// 정상 로드하므로 그대로 둔다.
export function toDisplayableImageUri(uri: string): string {
  if (Platform.OS === 'android' && uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return uri;
}
