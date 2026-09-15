const reactNativeConfig = require('@react-native/eslint-config/flat');

module.exports = [
  {
    ignores: [
      // eslintrc ignored dot-directories (.worktrees, .claude, ...) by default; flat config does not
      '**/.*/',
      // native build output (gitignored), e.g. ios/build/DerivedData
      '**/build/',
    ],
  },
  ...reactNativeConfig,
  {
    // ponytail: eslint-plugin-ft-flow 2.x crashes on ESLint 9 (context.getAllComments was removed)
    // and this project has no Flow code. Drop once @react-native/eslint-config ships an ESLint 9-safe ft-flow.
    files: ['**/*.js'],
    rules: {
      'ft-flow/define-flow-type': 'off',
      'ft-flow/use-flow-type': 'off',
    },
  },
];
