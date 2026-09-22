import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from '../src/screens/SettingsScreen';
import { FCM_SERMON_KEY, LEGACY_SERMON_CACHE_KEY } from '../src/types/Sermon';
import {
  syncSelectedSermonToWidget,
  fetchLatestSermonFromServer,
  fetchLatestWeeklySermonsFromServer,
  saveSermonToAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  pushSermonToWidget,
} from '../src/services/sermonService';

jest.mock('../src/services/sermonService', () => ({
  ...jest.requireActual('../src/services/sermonService'),
  syncSelectedSermonToWidget: jest.fn().mockResolvedValue(undefined),
  fetchLatestSermonFromServer: jest.fn().mockResolvedValue(null),
  fetchLatestWeeklySermonsFromServer: jest.fn().mockResolvedValue([]),
  saveSermonToAsyncStorage: jest.fn().mockResolvedValue(undefined),
  saveWeeklySermonsToAsyncStorage: jest.fn().mockResolvedValue(undefined),
  pushSermonToWidget: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/qtService', () => ({
  ...jest.requireActual('../src/services/qtService'),
  fetchLatestQtFromServer: jest.fn().mockResolvedValue(null),
  pushQtToWidget: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/components/SvgIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  return jest.fn().mockImplementation(() => <View />);
});

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
} as any;

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders worship time settings options and saves changes', async () => {
    // Mock user_worship_setting in AsyncStorage to be null (default to SUN_0950)
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'user_worship_setting') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);

    // Verify section header exists
    await waitFor(() => {
      expect(getByText('예배 시간 설정')).toBeTruthy();
    });

    // Check if "전체" + the 4 worship options are rendered ([#278])
    expect(getByText('전체')).toBeTruthy();
    expect(getByText('토요일 오후 5시')).toBeTruthy();
    expect(getByText('주일 9시 50분')).toBeTruthy();
    expect(getByText('주일 11시 50분')).toBeTruthy();
    expect(getByText('주일 2시 30분')).toBeTruthy();

    // Select "주일 11시 50분" option
    const optionButton = getByText('주일 11시 50분');
    fireEvent.press(optionButton);

    // Should save to AsyncStorage
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user_worship_setting', 'SUN_1150');
      // Should sync widget
      expect(syncSelectedSermonToWidget).toHaveBeenCalledWith('SUN_1150');
    });
  });

  it('"전체" 선택 시 레거시 단일 문서 경로로 동기화한다 ([#278])', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    const legacySermon = { id: 'legacy-1', date: '2026-09-15' };
    (fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
    await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

    fireEvent.press(getByText('전체'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user_worship_setting', 'ALL');
      expect(fetchLatestSermonFromServer).toHaveBeenCalled();
      expect(saveSermonToAsyncStorage).toHaveBeenCalledWith(legacySermon);
      expect(pushSermonToWidget).toHaveBeenCalledWith(legacySermon);
      // '전체'는 weekly_sermons 매칭 경로를 타지 않아야 한다
      expect(syncSelectedSermonToWidget).not.toHaveBeenCalled();
    });
  });

  // useFCMListener가 FCM payload를 legacy 전용 캐시(LEGACY_SERMON_CACHE_KEY)에 미리
  // 반영해뒀는데(#302), Firestore를 무조건 신뢰해 덮어써버리면 테스트 도구처럼 Firestore를
  // 아직 안 쓴 경우 방금 온 내용이 사라져 보인다. 캐시가 Firestore보다 최신이면 캐시를 써야 한다.
  it('"전체"로 바꿀 때 legacy 캐시가 Firestore 최신 문서보다 최신이면 캐시를 쓴다', async () => {
    const cachedFromFcm = {
      id: 'fcm-1', title: '캐시(방금 FCM으로 들어옴)', content: 'C', date: '2026-09-22',
      created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 2000, nanoseconds: 0 },
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === LEGACY_SERMON_CACHE_KEY) return Promise.resolve(JSON.stringify(cachedFromFcm));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    const staleFirestoreSermon = {
      id: 'legacy-1', title: 'Firestore(아직 안 갱신됨)', content: 'C', date: '2026-09-15',
      created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 1000, nanoseconds: 0 },
    };
    (fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(staleFirestoreSermon);

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
    await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

    fireEvent.press(getByText('전체'));

    await waitFor(() => {
      expect(saveSermonToAsyncStorage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'fcm-1' }),
      );
      expect(pushSermonToWidget).toHaveBeenCalledWith(expect.objectContaining({ id: 'fcm-1' }));
    });
  });

  // 실사용자 리포트로 발견된 버그: 특정 예배시간(sermons-v2)을 보다가 '전체'로 돌아오면
  // FCM_SERMON_KEY에 남아있던 그 예배 내용을 legacy 내용으로 착각해서 보여줬다.
  // FCM_SERMON_KEY가 아무리 최신이어도 '전체'는 그걸 무시하고 Firestore(또는 legacy 전용
  // 캐시)만 봐야 한다.
  it('"전체"로 돌아올 때 FCM_SERMON_KEY에 남은 다른 예배(sermons-v2) 내용을 legacy로 착각하지 않는다', async () => {
    const otherWorshipSermon = {
      id: 'w38_sun_0950', title: '주일 9시 50분 예배(sermons-v2)', content: 'C', date: '2026-09-22',
      worship_type: 'SUN_0950', week: '2026-W38',
      created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 9999, nanoseconds: 0 },
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      // FCM_SERMON_KEY엔 마지막으로 보던 특정 예배(sermons-v2) 내용이 남아있다 —
      // legacy 전용 캐시(LEGACY_SERMON_CACHE_KEY)는 비어있는 상태(아직 legacy 이벤트가
      // 온 적 없음)를 가정한다.
      if (key === FCM_SERMON_KEY) return Promise.resolve(JSON.stringify(otherWorshipSermon));
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    const legacySermon = {
      id: 'legacy-1', title: 'Firestore의 실제 legacy 문서', content: 'C', date: '2026-09-15',
      created_at: { seconds: 0, nanoseconds: 0 }, updated_at: { seconds: 1000, nanoseconds: 0 },
    };
    (fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

    const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
    await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

    fireEvent.press(getByText('전체'));

    await waitFor(() => {
      expect(saveSermonToAsyncStorage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'legacy-1' }),
      );
      expect(pushSermonToWidget).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w38_sun_0950' }),
      );
    });
  });

  describe('데이터 새로고침 버튼', () => {
    it('특정 예배가 선택돼 있으면 주간(sermons-v2) 데이터에서 매칭된 예배로 화면을 갱신한다', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('SUN_1150');
        return Promise.resolve(null);
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
      const weekly = [
        { id: 'sat', worship_type: 'SAT_1700', date: '2026-09-19' },
        { id: 'sun1150', worship_type: 'SUN_1150', date: '2026-09-20' },
      ];
      (fetchLatestWeeklySermonsFromServer as jest.Mock).mockResolvedValue(weekly);

      const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

      fireEvent.press(getByText('데이터 새로고침'));

      await waitFor(() => {
        expect(fetchLatestWeeklySermonsFromServer).toHaveBeenCalled();
        expect(saveWeeklySermonsToAsyncStorage).toHaveBeenCalledWith(weekly);
        expect(pushSermonToWidget).toHaveBeenCalledWith(weekly[1]);
      });
    });

    // 특정 예배시간에서 새로고침해도 legacy('전체') 캐시를 같이 최신화해둬야 한다 —
    // 안 그러면 나중에 '전체'로 설정을 바꿨을 때 새로고침을 다시 눌러야만 서버 최신
    // 내용이 보였다(실사용자 리포트로 발견 — weekly만 그랬을 때의 [#302]와 대칭인 문제).
    it('특정 예배가 선택돼 있어도 새로고침 시 legacy 캐시를 서버 최신 문서로 같이 갱신한다', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('SUN_1150');
        return Promise.resolve(null);
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
      const weekly = [{ id: 'sun1150', worship_type: 'SUN_1150', date: '2026-09-20' }];
      (fetchLatestWeeklySermonsFromServer as jest.Mock).mockResolvedValue(weekly);
      const legacySermon = { id: 'legacy-1', date: '2026-09-22' };
      (fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

      const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

      fireEvent.press(getByText('데이터 새로고침'));

      await waitFor(() => {
        // 화면(위젯)엔 여전히 특정 예배 내용이 반영돼야 한다 — legacy로 덮이면 안 된다.
        expect(pushSermonToWidget).toHaveBeenCalledWith(weekly[0]);
        expect(pushSermonToWidget).not.toHaveBeenCalledWith(
          expect.objectContaining({ id: 'legacy-1' }),
        );
        // 하지만 legacy('전체') 캐시는 서버 최신 문서로 백그라운드에서 갱신돼야 한다.
        expect(fetchLatestSermonFromServer).toHaveBeenCalled();
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          LEGACY_SERMON_CACHE_KEY,
          JSON.stringify(legacySermon),
        );
      });
    });

    // '전체' 화면 표시는 레거시 단일 문서를 쓰지만, weekly 캐시도 함께 최신화해둬야
    // 나중에 특정 예배시간으로 설정을 바꿨을 때 새로고침을 다시 누르지 않아도 된다([#302]).
    it('"전체"가 선택돼 있으면 레거시 단일 문서로 화면을 갱신하면서 weekly 캐시도 같이 최신화한다', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('ALL');
        return Promise.resolve(null);
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
      const weekly = [{ id: 'sat', worship_type: 'SAT_1700', date: '2026-09-19' }];
      (fetchLatestWeeklySermonsFromServer as jest.Mock).mockResolvedValue(weekly);
      const legacySermon = { id: 'legacy-1', date: '2026-09-20' };
      (fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

      const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

      fireEvent.press(getByText('데이터 새로고침'));

      await waitFor(() => {
        expect(fetchLatestWeeklySermonsFromServer).toHaveBeenCalled();
        expect(saveWeeklySermonsToAsyncStorage).toHaveBeenCalledWith(weekly);
        expect(fetchLatestSermonFromServer).toHaveBeenCalled();
        expect(pushSermonToWidget).toHaveBeenCalledWith(legacySermon);
      });
    });

    it('주간 데이터가 비어있으면 레거시 단일 문서로 폴백한다', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'user_worship_setting') return Promise.resolve('SAT_1700');
        return Promise.resolve(null);
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
      (fetchLatestWeeklySermonsFromServer as jest.Mock).mockResolvedValue([]);
      const legacySermon = { id: 'legacy-2', date: '2026-09-20' };
      (fetchLatestSermonFromServer as jest.Mock).mockResolvedValue(legacySermon);

      const { getByText } = render(<SettingsScreen navigation={mockNavigation} route={{} as any} />);
      await waitFor(() => expect(getByText('예배 시간 설정')).toBeTruthy());

      fireEvent.press(getByText('데이터 새로고침'));

      await waitFor(() => {
        expect(fetchLatestWeeklySermonsFromServer).toHaveBeenCalled();
        expect(fetchLatestSermonFromServer).toHaveBeenCalled();
        expect(pushSermonToWidget).toHaveBeenCalledWith(legacySermon);
      });
    });
  });
});
