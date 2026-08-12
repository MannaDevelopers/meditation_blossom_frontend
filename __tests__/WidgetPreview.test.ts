import { cardWidthForPreset, CARD_WIDTH_MIN, CARD_WIDTH_MAX, SIZE_PRESETS } from '../src/components/WidgetPreview';

describe('cardWidthForPreset', () => {
  it('첫 프리셋(최소)은 CARD_WIDTH_MIN을 반환', () => {
    expect(cardWidthForPreset(0)).toBe(CARD_WIDTH_MIN);
  });

  it('마지막 프리셋(최대)은 CARD_WIDTH_MAX를 반환', () => {
    expect(cardWidthForPreset(SIZE_PRESETS.length - 1)).toBe(CARD_WIDTH_MAX);
  });

  it('프리셋 인덱스가 커질수록 너비도 단조 증가한다', () => {
    const widths = SIZE_PRESETS.map((_, i) => cardWidthForPreset(i));
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
  });
});
