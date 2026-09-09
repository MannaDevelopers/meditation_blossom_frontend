import { MAX_PREVIEW_SIZE } from '../src/components/WidgetPreview';

describe('MAX_PREVIEW_SIZE', () => {
  it('배너형/카드형 미리보기는 항상 같은 너비를 가진다 (디자인 차이에 집중할 수 있도록 크기 통일)', () => {
    expect(MAX_PREVIEW_SIZE.bannerWidth).toEqual(MAX_PREVIEW_SIZE.cardWidth);
  });

  it('너비/높이가 유효한 양수다', () => {
    expect(MAX_PREVIEW_SIZE.bannerWidth).toBeGreaterThan(0);
    expect(MAX_PREVIEW_SIZE.height).toBeGreaterThan(0);
  });
});
