const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve(
      "react-native-svg-transformer/react-native"
    )
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...sourceExts, "svg"],
    /**
     * RN 0.86.2부터 react-native 패키지 자체에 package.json "exports" 필드가
     * 새로 추가되면서, 이 옵션이 켜져 있으면 react-native 내부의 상대경로 require
     * (Libraries/Core/setUpPerformance.js → setUpPerformanceModern 등)가 깨져
     * 앱 시작 즉시 "[runtime not ready]: TypeError: Object is not a function"로
     * 크래시한다. RN 0.78.1 당시 Firebase 관련 이슈(ISSUE-46) 대응으로 켰던
     * 옵션이지만, 현재는 이 크래시를 막기 위해 꺼야 한다.
     */
    unstable_enablePackageExports: false,
    unstable_conditionNames: ["react-native", "browser", "require", "import"],
    /**
     * iOS에서 react-native-tab-view의 Pager.ios.js(PagerViewAdapter, RNCViewPager 의존)를
     * 순수 JS 구현인 JsPager.tsx로 교체한다.
     * 이를 통해 react-native-pager-view 네이티브 모듈 없이도 탭 전환이 동작한다.
     */
    resolveRequest: (context, moduleName, platform) => {
      if (
        platform === "ios" &&
        context.originModulePath.includes("react-native-tab-view") &&
        /[/\\]Pager(\.ios)?$/.test(moduleName.replace(/\.js$/, ""))
      ) {
        return {
          filePath: path.resolve(__dirname, "src/navigation/JsPager.tsx"),
          type: "sourceFile",
        };
      }
      /**
       * RN 0.86.2의 DebuggingOverlayNativeComponent.js가 codegenNativeCommands에
       * ReadonlyArray<T> 타입을 넘겨서 Metro codegen 파서가 dev 번들 변환 시 500 에러를
       * 던진다 (facebook/react-native, 미병합). 무동작 스텁으로 리다이렉트해 회피.
       */
      if (
        /specs_DEPRECATED[/\\]components[/\\]DebuggingOverlayNativeComponent$/.test(
          moduleName.replace(/\.js$/, "")
        )
      ) {
        return {
          filePath: path.resolve(
            __dirname,
            "src/native-stubs/DebuggingOverlayNativeComponentStub.tsx"
          ),
          type: "sourceFile",
        };
      }
      /**
       * axios(sp-react-native-in-app-updates → react-native-siren → apisauce →
       * axios 의존 체인, 강제 업데이트 기능에 사용)의 package.json은 "main"이
       * Node.js 전용 빌드(dist/node/axios.cjs, crypto/http 등 Node core 모듈 require)를
       * 가리키고, RN 호환 빌드(dist/browser/axios.cjs)로의 리다이렉트는 "exports" 맵의
       * react-native/browser 조건에만 있다. unstable_enablePackageExports를 꺼둔 상태라
       * 이 조건이 적용되지 않아 Metro가 Node 빌드를 골라 "Unable to resolve module
       * crypto"로 번들링이 실패한다. axios 진입점만 명시적으로 browser 빌드로 리다이렉트.
       */
      if (moduleName === "axios") {
        return context.resolveRequest(
          context,
          "axios/dist/browser/axios.cjs",
          platform
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  }
};

module.exports = mergeConfig(defaultConfig, config);
