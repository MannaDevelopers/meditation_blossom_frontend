import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from '../src/screens/SettingsScreen';
import {
  syncSelectedSermonToWidget,
  fetchLatestSermonFromServer,
  saveSermonToAsyncStorage,
  pushSermonToWidget,
} from '../src/services/sermonService';

jest.mock('../src/services/sermonService', () => ({
  ...jest.requireActual('../src/services/sermonService'),
  syncSelectedSermonToWidget: jest.fn().mockResolvedValue(undefined),
  fetchLatestSermonFromServer: jest.fn().mockResolvedValue(null),
  saveSermonToAsyncStorage: jest.fn().mockResolvedValue(undefined),
  pushSermonToWidget: jest.fn().mockResolvedValue(undefined),
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
});
