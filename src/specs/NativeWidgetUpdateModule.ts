import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  onSermonUpdated(sermonData: string): Promise<boolean>;
  onQtUpdated(qtData: string): Promise<boolean>;
  // 네이티브가 갤러리 배경 사진을 다운샘플링해 영구 저장한 뒤 그 경로로 재작성한
  // 디자인 JSON을 반환한다 — RN이 임시 피커 경로 대신 이 영구 경로를 캐싱해야
  // 재진입 시에도 안정적으로 미리보기/재저장이 가능하다.
  onWidgetDesignUpdated(designData: string): Promise<string>;
  onQtWidgetDesignUpdated(designData: string): Promise<string>;
  // 사진 피커가 만든 휘발성 임시 파일을 앱이 관리하는 안정적인 캐시 경로로 즉시 복사하고,
  // 그 경로를 반환한다([#252]) — 원본 피커 경로는 OS가 예고 없이 정리할 수 있어 "최근 이미지"
  // 목록이나 이후 저장 시점까지 그대로 참조하면 안 된다.
  persistPickedImage(sourceUri: string): Promise<string>;
  resolveBibleReferences(jsonString: string): Promise<string>;
  onClear(): Promise<void>;
  // iOS 전용(App Group 조회). Android는 no-op으로 항상 null을 resolve한다.
  getAppGroupData(key: string): Promise<string | null>;
  setYoutubeLinkEnabled(enabled: boolean): Promise<void>;
  getYoutubeLinkEnabled(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WidgetUpdateModule');
