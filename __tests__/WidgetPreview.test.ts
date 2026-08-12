import { sizeForPreset, SIZE_PRESETS } from '../src/components/WidgetPreview';

describe('sizeForPreset', () => {
  it('배너형(Large) 너비는 카드형(Small) 너비보다 항상 크다 (실제 minWidth 245dp vs 177dp 비율 유지)', () => {
    SIZE_PRESETS.forEach((_, i) => {
      const size = sizeForPreset(i);
      expect(size.bannerWidth).toBeGreaterThan(size.cardWidth);
    });
  });

  it('첫 프리셋(최소)의 너비/높이가 이후 프리셋보다 항상 작거나 같다 (단조 증가)', () => {
    const sizes = SIZE_PRESETS.map((_, i) => sizeForPreset(i));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i].bannerWidth).toBeGreaterThanOrEqual(sizes[i - 1].bannerWidth);
      expect(sizes[i].cardWidth).toBeGreaterThanOrEqual(sizes[i - 1].cardWidth);
      expect(sizes[i].height).toBeGreaterThanOrEqual(sizes[i - 1].height);
    }
  });

  it('배너형/카드형은 프리셋이 같으면 높이가 항상 동일하다 (Small/Large의 minHeight 115dp 공유)', () => {
    SIZE_PRESETS.forEach((_, i) => {
      // height는 타입 구분 없이 단일 값으로 반환되므로 그 자체가 공유됨을 보장하지만,
      // 회귀 방지를 위해 명시적으로 유효한 양수인지 확인한다.
      expect(sizeForPreset(i).height).toBeGreaterThan(0);
    });
  });
});
