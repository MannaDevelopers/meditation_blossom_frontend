import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

/// UIScene 라이프사이클 진입점([#342]).
///
/// iOS 27 SDK부터 UIScene을 쓰지 않는 앱은 실행 직후 종료되므로, RN 0.88 템플릿과 같이
/// React Native 시작과 URL(딥링크·위젯 탭) 처리를 AppDelegate에서 이쪽으로 옮겼다.
/// Firebase 초기화, FCM/APNs, 알림 권한·응답 처리는 앱 단위 이벤트라 AppDelegate에 그대로 둔다.
class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    // New Architecture(Fabric)에서 react-native-screens/svg/safe-area-context 등 서드파티 컴포넌트를
    // Fabric 네이티브로 등록하려면 필요하다. 없으면 전부 Legacy Interop(plain RCTView)로 빠져
    // RCT_EXPORT_VIEW_PROPERTY prop 디스패치에서 크래시난다(기존 AppDelegate와 동일).
    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)

    reactNativeFactory?.startReactNative(
      withModuleName: "meditation_blossom",
      in: window,
      connectionOptions: connectionOptions
    )

    // 콜드 스타트로 열린 URL은 scene(_:openURLContexts:)가 호출되지 않고 connectionOptions로만 온다.
    // meditationblossom:// 는 startReactNative가 launchOptions로 변환해 Linking.getInitialURL로
    // 전달하므로, 여기서는 위젯의 외부 링크(http/https)만 처리한다.
    openExternalWebURLs(connectionOptions.urlContexts)
  }

  // 앱이 떠 있는 상태에서 위젯/외부가 URL로 앱을 열 때
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    let appURLContexts = URLContexts.filter { !Self.isWebURL($0.url) }
    openExternalWebURLs(URLContexts)
    if !appURLContexts.isEmpty {
      // meditationblossom:// 딥링크는 React Native(Linking)로 전달 — App.tsx linking(getStateFromPath)
      RCTLinkingManager.scene(scene, openURLContexts: appURLContexts)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }

  // MARK: - 위젯 외부 링크

  /// WidgetKit 제약: 위젯은 외부 URL(유튜브 등)을 직접 못 열고 항상 호스트 앱을 먼저 띄운다.
  /// 그래서 위젯이 http/https URL로 앱을 열면, 앱이 그 URL을 받아 외부 앱/브라우저로 넘긴다.
  private func openExternalWebURLs(_ contexts: Set<UIOpenURLContext>) {
    for context in contexts where Self.isWebURL(context.url) {
      UIApplication.shared.open(context.url, options: [:], completionHandler: nil)
    }
  }

  private static func isWebURL(_ url: URL) -> Bool {
    let scheme = url.scheme?.lowercased()
    return scheme == "http" || scheme == "https"
  }
}
