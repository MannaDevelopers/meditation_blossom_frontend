module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-firebase|@react-native-async-storage|react-native-gesture-handler|react-native-safe-area-context|@react-navigation)/)',
  ],
};
