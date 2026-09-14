import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from '../src/screens/SettingsScreen';
import { syncSelectedSermonToWidget } from '../src/services/sermonService';

jest.mock('../src/services/sermonService', () => ({
  ...jest.requireActual('../src/services/sermonService'),
  syncSelectedSermonToWidget: jest.fn().mockResolvedValue(undefined),
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

    // Check if the 4 options are rendered
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
});
