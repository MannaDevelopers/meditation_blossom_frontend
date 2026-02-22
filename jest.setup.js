jest.mock('@react-native-firebase/crashlytics', () => () => ({
  log: jest.fn(),
  recordError: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(),
  getDocsFromCache: jest.fn(),
  getDocsFromServer: jest.fn(),
  getFirestore: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
}));

jest.mock('@react-native-firebase/messaging', () => () => ({
  getToken: jest.fn(),
  onMessage: jest.fn(),
  subscribeToTopic: jest.fn(),
}));

jest.mock('@react-native-firebase/app', () => ({
  firebase: { app: jest.fn() },
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  }));
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }) => children,
  ScrollView: require('react-native').ScrollView,
  Swipeable: jest.fn(),
  DrawerLayout: jest.fn(),
  State: {},
  PanGestureHandler: jest.fn(),
  BaseButton: jest.fn(),
  Directions: {},
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  getString: jest.fn(),
  setString: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
}));

jest.mock('sp-react-native-in-app-updates', () => {
  const mock = jest.fn().mockImplementation(() => ({
    checkNeedsUpdate: jest.fn().mockResolvedValue({ shouldUpdate: false }),
    startUpdate: jest.fn().mockResolvedValue(undefined),
    installUpdate: jest.fn(),
    addStatusUpdateListener: jest.fn(),
    removeStatusUpdateListener: jest.fn(),
    addIntentSelectionListener: jest.fn(),
    removeIntentSelectionListener: jest.fn(),
  }));
  mock.IAUUpdateKind = { FLEXIBLE: 0, IMMEDIATE: 1 };
  mock.IAUAvailabilityStatus = { UNKNOWN: 0, AVAILABLE: 2, UNAVAILABLE: 1, DEVELOPER_TRIGGERED: 3 };
  mock.IAUInstallStatus = { UNKNOWN: 0, PENDING: 1, DOWNLOADING: 2, INSTALLING: 3, INSTALLED: 4, FAILED: 5, CANCELED: 6, DOWNLOADED: 11 };
  return {
    __esModule: true,
    default: mock,
    IAUUpdateKind: { FLEXIBLE: 0, IMMEDIATE: 1 },
    IAUAvailabilityStatus: { UNKNOWN: 0, AVAILABLE: 2, UNAVAILABLE: 1, DEVELOPER_TRIGGERED: 3 },
    IAUInstallStatus: { UNKNOWN: 0, PENDING: 1, DOWNLOADING: 2, INSTALLING: 3, INSTALLED: 4, FAILED: 5, CANCELED: 6, DOWNLOADED: 11 },
  };
});

jest.mock('@react-native-firebase/remote-config', () => {
  const mockGetValue = jest.fn((key) => {
    const defaults = {
      force_update_enabled: { asBoolean: () => false, asString: () => 'false' },
      android_min_version: { asBoolean: () => false, asString: () => '1.0.0' },
      ios_min_version: { asBoolean: () => false, asString: () => '1.0.0' },
      force_update_message: { asBoolean: () => false, asString: () => '업데이트가 필요합니다.' },
      android_store_url: { asBoolean: () => false, asString: () => '' },
      ios_store_url: { asBoolean: () => false, asString: () => '' },
    };
    return defaults[key] || { asBoolean: () => false, asString: () => '' };
  });
  return () => ({
    setDefaults: jest.fn().mockResolvedValue(undefined),
    fetchAndActivate: jest.fn().mockResolvedValue(undefined),
    getValue: mockGetValue,
  });
});
