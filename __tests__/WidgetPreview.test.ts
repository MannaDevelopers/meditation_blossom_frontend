import {
  MAX_PREVIEW_SIZE,
  estimateCardTitleAreaHeight,
  CARD_TITLE_ESTIMATED_LINES_SERMON,
  CARD_TITLE_ESTIMATED_LINES_QT,
} from '../src/components/WidgetPreview';

describe('MAX_PREVIEW_SIZE', () => {
  it('배너형/카드형 미리보기는 항상 같은 너비를 가진다 (디자인 차이에 집중할 수 있도록 크기 통일)', () => {
    expect(MAX_PREVIEW_SIZE.bannerWidth).toEqual(MAX_PREVIEW_SIZE.cardWidth);
  });

  it('너비/높이가 유효한 양수다', () => {
    expect(MAX_PREVIEW_SIZE.bannerWidth).toBeGreaterThan(0);
    expect(MAX_PREVIEW_SIZE.height).toBeGreaterThan(0);
  });
});

describe('estimateCardTitleAreaHeight', () => {
  it('폰트 크기가 커질수록 제목 영역 예상 높이도 늘어난다 (2줄일 때 실제 위젯처럼 영역이 커져야 함)', () => {
    const small = estimateCardTitleAreaHeight(16, CARD_TITLE_ESTIMATED_LINES_SERMON);
    const large = estimateCardTitleAreaHeight(28, CARD_TITLE_ESTIMATED_LINES_SERMON);
    expect(large).toBeGreaterThan(small);
  });

  it('예상 줄 수가 많을수록(주일 말씀 > QT) 제목 영역도 더 크게 잡는다', () => {
    const sermonHeight = estimateCardTitleAreaHeight(20, CARD_TITLE_ESTIMATED_LINES_SERMON);
    const qtHeight = estimateCardTitleAreaHeight(20, CARD_TITLE_ESTIMATED_LINES_QT);
    expect(sermonHeight).toBeGreaterThan(qtHeight);
  });
});
