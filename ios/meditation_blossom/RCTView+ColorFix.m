// RCTView+ColorFix.m
//
// New Architecture(Fabric)에서 일부 라이브러리(react-native-screens 등)의 구버전 뷰 매니저가
// RCTLegacyViewManagerInteropComponentView 래핑 경로로 진입할 때,
// 뷰 매니저에 RCT_EXPORT_VIEW_PROPERTY(color, UIColor) 로 등록된 prop을
// ObjC 메시지 디스패치(setColor:)로 설정하려다 크래시가 발생한다.
//
// 원인: RNSScreenStackHeaderConfigManager 가 RCTViewManager를 상속하면서
//       -view 를 오버라이드하지 않아 legacy interop 경로에서 plain RCTView 가 생성되고,
//       RCTView 에 setColor: 구현체가 없어 doesNotRecognizeSelector: 크래시 발생.
//
// 다만 이 매니저가 애초에 legacy interop 경로로 빠진 진짜 원인은 AppDelegate.mm에
// `self.dependencyProvider = [RCTAppDependencyProvider new]`가 누락되어 있었기 때문이다.
// 이게 없으면 RCTComponentViewFactory가 thirdPartyFabricComponentsProvider를 못 찾아
// react-native-screens/react-native-svg/safe-area-context 등 서드파티 컴포넌트 전부가
// (실제 Fabric 클래스가 정상 컴파일되어 있어도) legacy interop으로 빠진다.
// dependencyProvider 연결 후에는 이 카테고리 없이도 크래시가 재현되지 않았다 — 즉 지금은
// 죽은 코드에 가깝다. 다만 pre-existing 코드라 최소 변경 원칙상 남겨둠. 완전히 제거해도 무방.
//
// 이 카테고리는 RCTView 와 그 슈퍼클래스 경로를 커버하도록 UIView 에 setColor: 를 무음 흡수한다.

#import <UIKit/UIKit.h>

@implementation UIView (ColorFix)

- (void)setColor:(id __unused)color {
  // Intentionally empty — absorbs `color` prop dispatched by
  // RCTLegacyViewManagerInteropComponentView for unported native view managers
  // (e.g. RNSScreenStackHeaderConfigManager which inherits RCTViewManager's -view,
  // creating a plain RCTView that has no setColor: implementation).
}

@end
