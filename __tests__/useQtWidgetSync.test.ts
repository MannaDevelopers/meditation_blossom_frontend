import { renderHook } from '@testing-library/react-native';
import { useQtWidgetSync } from '../src/hooks/useQtWidgetSync';
import WidgetUpdateModule from '../src/types/WidgetUpdateModule';
import type { QT } from '../src/types/QT';

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockOnQtUpdated = WidgetUpdateModule.onQtUpdated as jest.Mock;

const baseQt: QT = {
  id: 'qt-1',
  title: '빛의 자녀로 살라',
  series_title: '하나님의 손길',
  content: '본문 : 에베소서 5:15-16 15 그런즉... 16 세월을 아끼라...',
  date: '2026-04-26',
  day_of_week: 'SUN',
  created_at: { seconds: 0, nanoseconds: 0 },
  updated_at: { seconds: 0, nanoseconds: 0 },
};

describe('useQtWidgetSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('meditation_questions JSON 문자열을 array로 풀어서 onQtUpdated에 전달', () => {
    const qt: QT = {
      ...baseQt,
      meditation_questions: JSON.stringify(['Q1', 'Q2', 'Q3']),
    };

    renderHook(() => useQtWidgetSync(qt));

    expect(mockOnQtUpdated).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mockOnQtUpdated.mock.calls[0][0]);
    expect(payload.meditation_questions).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('meditation_questions가 undefined이면 빈 배열로 전달', () => {
    const qt: QT = { ...baseQt, meditation_questions: undefined };

    renderHook(() => useQtWidgetSync(qt));

    expect(mockOnQtUpdated).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mockOnQtUpdated.mock.calls[0][0]);
    expect(payload.meditation_questions).toEqual([]);
  });

  it('qt가 null이면 onQtUpdated 호출 안 함', () => {
    renderHook(() => useQtWidgetSync(null));
    expect(mockOnQtUpdated).not.toHaveBeenCalled();
  });
});
