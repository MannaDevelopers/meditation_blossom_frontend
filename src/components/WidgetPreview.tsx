import { useMemo, useState } from 'react';
import {
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { extractContent } from '../utils/sermonParser';
import { WidgetDesign } from '../types/WidgetDesign';
import { WIDGET_TEXT_WEIGHT_FONT_FAMILY } from '../constants';
import { lightenHexColor } from '../utils/widgetDesignColor';

const FRAME_WIDTH = 305;
const FRAME_HEIGHT = 480;

// Android Large 위젯 최소 크기 비율(245:115dp, [#169] 3.6절)
const BANNER_CARD_WIDTH = 265;
const BANNER_CARD_HEIGHT = Math.round((BANNER_CARD_WIDTH * 115) / 245);

// Android Small 위젯 최소 크기 비율(177:115dp)
const CARD_OUTER_WIDTH = 265;
const CARD_OUTER_HEIGHT = Math.round((CARD_OUTER_WIDTH * 115) / 177);
const CARD_TITLE_HEIGHT = 40;
const CARD_INNER_MARGIN = 10;

const CARD_BACKGROUND_LIGHTEN_DELTA = 18;
const GALLERY_SCRIM_OPACITY = 0.38;

const CARD_INDEX_GRADIENT = require('../assets/image/BackgroundImg.png');

type PreviewText = { index: string; content: string };

function resolveTextStyle(design: WidgetDesign): TextStyle {
  return {
    textAlign: design.text.align,
    fontFamily: WIDGET_TEXT_WEIGHT_FONT_FAMILY[design.text.weight],
    fontSize: design.text.size,
    color: design.text.color,
  };
}

// 배경 타입/값에 따른 렌더링 분기 — 두 프리뷰(배너형/카드형) 공통 판별 로직
function resolveBackgroundKind(design: WidgetDesign): 'gallery' | 'default-gradient' | 'solid' {
  if (design.background.type === 'gallery') return 'gallery';
  if (design.background.value === 'gradient-default') return 'default-gradient';
  return 'solid';
}

const BannerPreview = ({ index, content, design }: PreviewText & { design: WidgetDesign }) => {
  const textStyle = resolveTextStyle(design);
  const backgroundKind = resolveBackgroundKind(design);

  const inner = (
    <View style={styles.bannerInner}>
      <Text allowFontScaling={false} style={[styles.bannerContentText, textStyle]}>
        {content}
      </Text>
      <Text allowFontScaling={false} style={[styles.bannerIndexText, textStyle]}>
        {index}
      </Text>
    </View>
  );

  if (backgroundKind === 'gallery') {
    return (
      <ImageBackground
        source={{ uri: design.background.value }}
        style={styles.bannerCard}
        imageStyle={styles.cardRadius}
      >
        {inner}
      </ImageBackground>
    );
  }

  if (backgroundKind === 'default-gradient') {
    return (
      <ImageBackground source={CARD_INDEX_GRADIENT} style={styles.bannerCard} imageStyle={styles.cardRadius}>
        {inner}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.bannerCard, { backgroundColor: (design.background as { value: string }).value }]}>
      {inner}
    </View>
  );
};

// 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절):
// - 배경색: 제목 영역은 본문 카드보다 밝은 동일 계열 톤 (배너형과 구분되도록)
// - 배경 갤러리: 사진을 전체 배경으로 깔고, 본문 카드 자리를 반투명 검정 스크림으로 재해석
const CardPreview = ({ index, content, design }: PreviewText & { design: WidgetDesign }) => {
  const textStyle = resolveTextStyle(design);
  const backgroundKind = resolveBackgroundKind(design);

  if (backgroundKind === 'gallery') {
    return (
      <ImageBackground
        source={{ uri: design.background.value }}
        style={styles.cardOuter}
        imageStyle={styles.cardRadius}
      >
        <Text allowFontScaling={false} style={[styles.cardTitleOnPhoto, textStyle]}>
          {index}
        </Text>
        <View style={styles.cardScrim}>
          <Text allowFontScaling={false} style={[styles.cardContentText, textStyle]}>
            {content}
          </Text>
        </View>
      </ImageBackground>
    );
  }

  if (backgroundKind === 'default-gradient') {
    return (
      <View style={styles.cardOuterWhite}>
        <Text allowFontScaling={false} style={[styles.cardTitleDark, textStyle]}>
          {index}
        </Text>
        <ImageBackground source={CARD_INDEX_GRADIENT} style={styles.cardInner} imageStyle={styles.cardInnerRadius}>
          <Text allowFontScaling={false} style={[styles.cardContentText, textStyle]}>
            {content}
          </Text>
        </ImageBackground>
      </View>
    );
  }

  const solidColor = (design.background as { value: string }).value;
  const titleTint = lightenHexColor(solidColor, CARD_BACKGROUND_LIGHTEN_DELTA);

  return (
    <View style={[styles.cardOuterWhite, { backgroundColor: titleTint }]}>
      <Text allowFontScaling={false} style={[styles.cardTitleDark, textStyle]}>
        {index}
      </Text>
      <View style={[styles.cardInner, { backgroundColor: solidColor }]}>
        <Text allowFontScaling={false} style={[styles.cardContentText, textStyle]}>
          {content}
        </Text>
      </View>
    </View>
  );
};

const WidgetPreview = ({ content, design }: { content: string | undefined; design: WidgetDesign }) => {
  const [activePage, setActivePage] = useState(0);
  const extracted = useMemo<PreviewText>(
    () => (content ? extractContent(content) : { index: '', content: '' }),
    [content],
  );

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / FRAME_WIDTH);
    setActivePage(page);
  };

  return (
    <View style={styles.frame}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.scrollView}
      >
        <View style={styles.page}>
          <BannerPreview index={extracted.index} content={extracted.content} design={design} />
        </View>
        <View style={styles.page}>
          <CardPreview index={extracted.index} content={extracted.content} design={design} />
        </View>
      </ScrollView>
      <View style={styles.indicatorRow}>
        <View style={[styles.dot, activePage === 0 && styles.dotActive]} />
        <View style={[styles.dot, activePage === 1 && styles.dotActive]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: FRAME_WIDTH,
    alignItems: 'center',
  },
  scrollView: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  },
  page: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRadius: {
    borderRadius: 15,
  },
  // 배너형(Large)
  bannerCard: {
    width: BANNER_CARD_WIDTH,
    height: BANNER_CARD_HEIGHT,
    borderRadius: 15,
    overflow: 'hidden',
  },
  bannerInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerContentText: {
    lineHeight: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bannerIndexText: {
    fontSize: 13,
    opacity: 0.8,
  },
  // 카드형(Small) — 이중 레이어
  cardOuter: {
    width: CARD_OUTER_WIDTH,
    height: CARD_OUTER_HEIGHT,
    borderRadius: 15,
    overflow: 'hidden',
  },
  cardOuterWhite: {
    width: CARD_OUTER_WIDTH,
    height: CARD_OUTER_HEIGHT,
    borderRadius: 15,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  cardTitleDark: {
    height: CARD_TITLE_HEIGHT,
    paddingHorizontal: 12,
    color: 'black',
    fontSize: 13,
    textAlignVertical: 'center',
  },
  cardTitleOnPhoto: {
    height: CARD_TITLE_HEIGHT,
    paddingHorizontal: 12,
    fontSize: 13,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  cardInner: {
    flex: 1,
    marginHorizontal: CARD_INNER_MARGIN,
    marginBottom: CARD_INNER_MARGIN,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  cardInnerRadius: {
    borderRadius: 10,
  },
  cardScrim: {
    flex: 1,
    marginHorizontal: CARD_INNER_MARGIN,
    marginBottom: CARD_INNER_MARGIN,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: `rgba(0,0,0,${GALLERY_SCRIM_OPACITY})`,
  },
  cardContentText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 'bold',
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
});

export default WidgetPreview;
