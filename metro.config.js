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
     * RN 0.88부터 react-native 내부(react-private-interface, asset-registry)와
     * @react-native/asset-utils가 package.json "exports"로만 해석되므로 반드시 켜야 한다.
     *
     * 예전(0.86.2)에 이 옵션을 켜면 "[runtime not ready]: TypeError: Object is not a function"로
     * 시작 즉시 크래시해서 꺼뒀었는데, 진짜 원인은 함께 지정했던
     * unstable_conditionNames: ["react-native", "browser", "require", "import"]였다.
     * "import" 조건 때문에 일부 패키지의 ESM 빌드가 골라져 기본 export 해석이 깨졌다.
     * conditionNames는 지정하지 말고 @react-native/metro-config 기본값(["react-native"])을 쓴다.
     */
    unstable_enablePackageExports: true,
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
       * react-native/browser 조건에만 있다. exports를 꺼뒀던 시기(RN 0.86)에는 Metro가 Node
       * 빌드를 골라 "Unable to resolve module crypto"로 번들링이 실패해 이 리다이렉트를 넣었다.
       * RN 0.88에서 exports를 다시 켰으므로 없어도 react-native 조건으로 해석되지만, 검증된
       * CJS browser 빌드로 고정해 두기 위해 유지한다.
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
