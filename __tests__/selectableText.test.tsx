import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../src/screens/HomeScreen';
import DailyMannaScreen from '../src/screens/DailyMannaScreen';

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn().mockResolvedValue(undefined),
  setUserProperty: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => cb(),
}));

jest.mock('../src/components/SvgIcon', () => 'SvgIcon');

jest.mock('../src/hooks/useSermonData', () => ({
  useSermonData: () => ({
    sermon: {
      id: 'sermon-1',
      title: '설교 제목',
      content: '본문 : 창세기 1:1 1 태초에 하나님이 천지를 창조하시니라',
      date: '2026-07-17',
      category: '주일설교',
    },
    isLoading: false,
    setIsLoading: jest.fn(),
    error: null,
    loadLocalData: jest.fn(),
    fetchFromServer: jest.fn(),
    onRefresh: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAppGroupSync', () => ({
  useAppGroupSync: () => ({ performInitialSync: jest.fn() }),
}));

jest.mock('../src/hooks/useWidgetSync', () => ({
  useWidgetSync: jest.fn(),
}));

jest.mock('../src/hooks/useFCMListener', () => ({
  useFCMListener: jest.fn(),
}));

jest.mock('../src/hooks/useQtData', () => ({
  useQtData: () => ({
    qt: {
      id: 'qt-1',
      title: 'QT 제목',
      series_title: '매일 묵상',
      content: '본문 : 에베소서 5:15-16 15 지혜롭게 행하여 16 세월을 아끼라',
      date: '2026-07-17',
      day_of_week: 'FRI',
      meditation_questions: '["질문 1입니다.", "질문 2입니다."]',
    },
    isLoading: false,
    setIsLoading: jest.fn(),
    error: null,
    loadLocalData: jest.fn(),
    fetchFromServer: jest.fn(),
    onRefresh: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useQtWidgetSync', () => ({
  useQtWidgetSync: jest.fn(),
}));

jest.mock('../src/hooks/useQtFCMListener', () => ({
  useQtFCMListener: jest.fn(),
}));

describe('Selectable Text displays', () => {
  it('makes HomeScreen sermon text selectable', () => {
    const { getByText } = render(<HomeScreen />);
    
    const titleText = getByText('설교 제목');
    const indexText = getByText('창세기 1:1');
    const contentText = getByText('1 태초에 하나님이 천지를 창조하시니라');
    
    expect(titleText.props.selectable).toBe(true);
    expect(indexText.props.selectable).toBe(true);
    expect(contentText.props.selectable).toBe(true);
  });

  it('makes DailyMannaScreen QT text and questions selectable', () => {
    const { getByText } = render(<DailyMannaScreen />);
    
    const titleText = getByText('QT 제목');
    const indexText = getByText('에베소서 5:15-16');
    const contentText = getByText('15 지혜롭게 행하여\n\n16 세월을 아끼라');
    const question1Text = getByText('질문 1입니다.');
    const question2Text = getByText('질문 2입니다.');
    
    expect(titleText.props.selectable).toBe(true);
    expect(indexText.props.selectable).toBe(true);
    expect(contentText.props.selectable).toBe(true);
    expect(question1Text.props.selectable).toBe(true);
    expect(question2Text.props.selectable).toBe(true);
  });
});
