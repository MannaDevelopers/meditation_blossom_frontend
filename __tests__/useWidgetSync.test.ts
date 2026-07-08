import { renderHook } from '@testing-library/react-native';
import { useWidgetSync } from '../src/hooks/useWidgetSync';
import WidgetUpdateModule from '../src/types/WidgetUpdateModule';
import type { Sermon } from '../src/types/Sermon';

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockOnSermonUpdated = WidgetUpdateModule.onSermonUpdated as jest.Mock;

const baseSermon: Sermon = {
  id: 'sermon-1',
  title: '오직 성령의 능력으로',
  content: '본문 : 사도행전 1:8',
  date: '2026-04-26',
  created_at: { seconds: 0, nanoseconds: 0 },
  updated_at: { seconds: 0, nanoseconds: 0 },
};

describe('useWidgetSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sermon이 있으면 onSermonUpdated에 JSON으로 전달', () => {
    renderHook(() => useWidgetSync(baseSermon));

    expect(mockOnSermonUpdated).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mockOnSermonUpdated.mock.calls[0][0]);
    expect(payload.id).toBe('sermon-1');
    expect(payload.date).toBe('2026-04-26');
  });

  it('sermon이 null이면 onSermonUpdated 호출 안 함', () => {
    renderHook(() => useWidgetSync(null));
    expect(mockOnSermonUpdated).not.toHaveBeenCalled();
  });
});
