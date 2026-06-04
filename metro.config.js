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
    unstable_enablePackageExports: true,
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
      return context.resolveRequest(context, moduleName, platform);
    },
  }
};

module.exports = mergeConfig(defaultConfig, config);
