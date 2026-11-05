import {
  fetchAndActivate,
  getRemoteConfig,
} from '@react-native-firebase/remote-config';
import {
  getForceUpdateConfig,
  initRemoteConfig,
} from '../src/services/forceUpdateService';
import logger from '../src/utils/logger';

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('forceUpdateService (RNFB 모듈형 Remote Config)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initRemoteConfig는 기본값과 fetch 간격을 인스턴스에 설정한 뒤 fetchAndActivate를 호출한다', async () => {
    await initRemoteConfig();

    const rc = (getRemoteConfig as jest.Mock).mock.results[0].value;
    expect(rc.defaultConfig).toMatchObject({
      force_update_enabled: false,
      android_min_version: '1.0.0',
      ios_min_version: '1.0.0',
    });
    // jest 환경은 __DEV__ === true → 개발용 간격 0
    expect(rc.settings.minimumFetchIntervalMillis).toBe(0);
    expect(rc.settings.fetchTimeoutMillis).toBe(60000);
    expect(fetchAndActivate).toHaveBeenCalledWith(rc);
  });

  it('fetchAndActivate가 실패하면 throw 대신 logger.error로 기록한다', async () => {
    (fetchAndActivate as jest.Mock).mockRejectedValueOnce(new Error('network'));

    await expect(initRemoteConfig()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch Remote Config',
      expect.any(Error),
    );
  });

  it('getForceUpdateConfig는 getValue(rc, key)로 값을 읽는다', () => {
    expect(getForceUpdateConfig()).toEqual({
      force_update_enabled: false,
      android_min_version: '1.0.0',
      ios_min_version: '1.0.0',
      force_update_message: '업데이트가 필요합니다.',
      android_store_url: '',
      ios_store_url: '',
    });
  });
});
