import React from 'react';
import { View } from 'react-native';

// RN 0.86.2의 node_modules/react-native/src/private/specs_DEPRECATED/components/
// DebuggingOverlayNativeComponent.js가 codegenNativeCommands에 ReadonlyArray<T> 타입을
// 넘기는데, Metro의 codegen 파서가 이를 지원하지 않아 dev 번들 요청이 HTTP 500으로
// 실패한다 (facebook/react-native, 미병합 상태로 트래킹 중). 이 파일은 codegenNativeCommands/
// codegenNativeComponent 호출 자체를 하지 않는 대체 구현으로, metro.config.js의
// resolveRequest에서 해당 모듈 요청을 이 파일로 리다이렉트한다. 이 컴포넌트는 RN 내부의
// 개발자 도구 전용 디버깅 오버레이(리렌더 하이라이트)라 무동작 스텁으로 대체해도
// 앱 기능에는 영향이 없다.

// @react-native/babel-plugin-codegen가 모든 파일에서 `export const Commands = ...`
// 형태를 codegenNativeCommands 결과로만 허용하도록 강제한다. 로컬 변수명을 다르게 해서
// `export { ... as Commands }`로 내보내면 이 검사(로컬 식별자명만 확인)를 우회할 수 있다.
const noopCommands = {
  highlightTraceUpdates: () => {},
  highlightElements: () => {},
  clearElementsHighlights: () => {},
};

export { noopCommands as Commands };
export default View;
