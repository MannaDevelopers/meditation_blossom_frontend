import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { extractContent } from '../utils/sermonParser';
import { WidgetDesign, WidgetImageTransform } from '../types/WidgetDesign';
import { WIDGET_TEXT_WEIGHT_FONT_FAMILY } from '../constants';
import { lightenHexColor } from '../utils/widgetDesignColor';
import { MIN_ZOOM, computeBaseScale } from '../utils/imageCropMath';

const FRAME_HEIGHT = 480;
const PAGE_MARGIN = 40; // 프레임 좌우 여백(20px씩)

// 실제 Android Glance 위젯(VerseWidgetLarge.kt/VerseWidgetSmall.kt)은 Small(177dp)과
// Large(245dp)의 minWidth가 다르지만, 미리보기에서는 배너형/카드형을 같은 크기로 보여줘
// 디자인(정렬/색상/두께) 차이에 집중할 수 있게 한다 — 실제 위젯 크기는 크기 프리셋
// (최소/보통/최대) 버튼으로 별도 확인한다.
const LARGE_MIN_WIDTH_DP = 245;
const MIN_HEIGHT_DP = 115;
const PREVIEW_SCALE = 265 / LARGE_MIN_WIDTH_DP; // 배너형 최소 너비가 265px가 되도록 하는 배율

const BANNER_MIN_WIDTH = Math.round(LARGE_MIN_WIDTH_DP * PREVIEW_SCALE);
const CARD_MIN_WIDTH = BANNER_MIN_WIDTH;
const MIN_CARD_HEIGHT = Math.round(MIN_HEIGHT_DP * PREVIEW_SCALE);

const CARD_TITLE_HEIGHT = 40;
const CARD_INNER_MARGIN = 10;

const CARD_BACKGROUND_LIGHTEN_DELTA = 18;
const GALLERY_SCRIM_OPACITY = 0.38;

const CARD_INDEX_GRADIENT = require('../assets/image/BackgroundImg.png');

// Android는 홈 화면에 배치한 위젯을 가로/세로 모두 리사이즈할 수 있다(android:resizeMode
// ="horizontal|vertical"). 최소/보통/최대 3단계로 너비·높이가 함께 늘어났을 때 텍스트/배경이
// 어떻게 보이는지 미리 확인할 수 있게 한다.
const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_BANNER_WIDTH = Math.min(SCREEN_WIDTH - 40, 480);
const WIDTH_SCALE_MAX = MAX_BANNER_WIDTH / BANNER_MIN_WIDTH;
const HEIGHT_SCALE_MAX = 2.2;

export const SIZE_PRESETS: { key: string; label: string }[] = [
  { key: 'min', label: '최소' },
  { key: 'medium', label: '보통' },
  { key: 'max', label: '최대' },
];

export type PreviewSize = { bannerWidth: number; cardWidth: number; height: number };

export function sizeForPreset(presetIndex: number, totalPresets: number = SIZE_PRESETS.length): PreviewSize {
  const ratio = totalPresets <= 1 ? 0 : presetIndex / (totalPresets - 1);
  const widthScale = 1 + (WIDTH_SCALE_MAX - 1) * ratio;
  const heightScale = 1 + (HEIGHT_SCALE_MAX - 1) * ratio;
  return {
    bannerWidth: Math.round(BANNER_MIN_WIDTH * widthScale),
    cardWidth: Math.round(CARD_MIN_WIDTH * widthScale),
    height: Math.round(MIN_CARD_HEIGHT * heightScale),
  };
}

type PreviewText = { title: string; index: string; content: string };

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

// ImageCropScreen(배경 위치 조정)에서 저장한 zoom/focalX/focalY를 미리보기에도 그대로 반영한다.
// ImageCropScreen과 동일하게 "cover" 기준 배율(computeBaseScale) 위에 zoom을 곱하고,
// 포커스 포인트가 프레임 중심에 오도록 이미지를 절대 위치시킨 뒤 프레임 밖을 자른다.
const GalleryBackground = ({
  uri,
  transform,
  width,
  height,
  style,
  children,
}: {
  uri: string;
  transform: WidgetImageTransform | undefined;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) => {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled) setImageSize({ width: w, height: h });
      },
      () => {
        if (!cancelled) setImageSize(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const zoom = transform?.zoom ?? MIN_ZOOM;
  const focalX = transform?.focalX ?? 0.5;
  const focalY = transform?.focalY ?? 0.5;

  const baseScale = imageSize ? computeBaseScale(imageSize.width, imageSize.height, width, height) : 0;
  const displayedWidth = imageSize ? imageSize.width * baseScale * zoom : 0;
  const displayedHeight = imageSize ? imageSize.height * baseScale * zoom : 0;

  return (
    <View style={[{ width, height, overflow: 'hidden' }, style]}>
      {imageSize && (
        <Image
          source={{ uri }}
          style={{
            position: 'absolute',
            left: width / 2 - focalX * displayedWidth,
            top: height / 2 - focalY * displayedHeight,
            width: displayedWidth,
            height: displayedHeight,
          }}
        />
      )}
      {children}
    </View>
  );
};

// 제목/장절은 실제 위젯처럼 고정 스타일(디자인 편집 대상 아님) — 본문(content)만 design.text를 따른다.
const BannerPreview = ({
  title,
  index,
  content,
  design,
  width,
  height,
}: PreviewText & { design: WidgetDesign; width: number; height: number }) => {
  const textStyle = resolveTextStyle(design);
  const backgroundKind = resolveBackgroundKind(design);
  const onPhoto = backgroundKind === 'gallery';
  const sizeStyle = { width, height };

  const inner = (
    <View style={styles.bannerInner}>
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[styles.bannerTitle, { color: design.text.color }, onPhoto && styles.textOnPhotoShadow]}
      >
        {title}
      </Text>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
        <Text allowFontScaling={false} style={[styles.bannerContentText, textStyle]}>
          {content}
        </Text>
      </ScrollView>
      <Text
        allowFontScaling={false}
        style={[styles.bannerIndexText, textStyle, onPhoto && styles.textOnPhotoShadow]}
      >
        {index}
      </Text>
    </View>
  );

  if (backgroundKind === 'gallery') {
    return (
      <GalleryBackground
        uri={design.background.value}
        transform={design.background.imageTransform}
        width={width}
        height={height}
        style={styles.bannerCard}
      >
        {inner}
      </GalleryBackground>
    );
  }

  if (backgroundKind === 'default-gradient') {
    return (
      <ImageBackground
        source={CARD_INDEX_GRADIENT}
        style={[styles.bannerCard, sizeStyle]}
        imageStyle={styles.cardRadius}
      >
        {inner}
      </ImageBackground>
    );
  }

  return (
    <View
      style={[
        styles.bannerCard,
        sizeStyle,
        { backgroundColor: (design.background as { value: string }).value },
      ]}
    >
      {inner}
    </View>
  );
};

// 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절):
// - 배경색: 제목 영역은 본문 카드보다 밝은 동일 계열 톤 (배너형과 구분되도록)
// - 배경 갤러리: 사진을 전체 배경으로 깔고, 제목이 놓이는 바깥 영역을 반투명 검정 스크림으로
//   가려 가독성을 확보한다. 본문 카드 안쪽은 사진이 그대로 비치도록 스크림 없이 텍스트 그림자만 적용.
// 실제 네이티브 위젯처럼 제목은 카드 바깥, 장절(색인)은 스크롤 영역 아래 고정 위치에 둔다.
const CardPreview = ({
  title,
  index,
  content,
  design,
  width,
  height,
}: PreviewText & { design: WidgetDesign; width: number; height: number }) => {
  const textStyle = resolveTextStyle(design);
  const backgroundKind = resolveBackgroundKind(design);
  const sizeStyle = { width, height };

  const body = (
    <>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
        <Text allowFontScaling={false} style={[styles.cardContentText, textStyle]}>
          {content}
        </Text>
      </ScrollView>
      <Text allowFontScaling={false} style={[styles.cardIndexText, textStyle]}>
        {index}
      </Text>
    </>
  );

  if (backgroundKind === 'gallery') {
    return (
      <GalleryBackground
        uri={design.background.value}
        transform={design.background.imageTransform}
        width={width}
        height={height}
        style={styles.cardOuter}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.cardTitleOnPhoto,
            styles.cardTitleOnPhotoScrim,
            { color: design.text.color },
            styles.textOnPhotoShadow,
          ]}
        >
          {title}
        </Text>
        <View style={styles.cardInner}>
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
            <Text allowFontScaling={false} style={[styles.cardContentText, textStyle, styles.textOnPhotoShadow]}>
              {content}
            </Text>
          </ScrollView>
          <Text allowFontScaling={false} style={[styles.cardIndexText, textStyle, styles.textOnPhotoShadow]}>
            {index}
          </Text>
        </View>
      </GalleryBackground>
    );
  }

  if (backgroundKind === 'default-gradient') {
    return (
      <View style={[styles.cardOuterWhite, sizeStyle]}>
        <Text allowFontScaling={false} numberOfLines={2} style={[styles.cardTitleDark, { color: design.text.color }]}>
          {title}
        </Text>
        <ImageBackground source={CARD_INDEX_GRADIENT} style={styles.cardInner} imageStyle={styles.cardInnerRadius}>
          {body}
        </ImageBackground>
      </View>
    );
  }

  const solidColor = (design.background as { value: string }).value;
  const titleTint = lightenHexColor(solidColor, CARD_BACKGROUND_LIGHTEN_DELTA);

  return (
    <View style={[styles.cardOuterWhite, sizeStyle, { backgroundColor: titleTint }]}>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.cardTitleDark, { color: design.text.color }]}>
        {title}
      </Text>
      <View style={[styles.cardInner, { backgroundColor: solidColor }]}>{body}</View>
    </View>
  );
};

const WidgetPreview = ({
  title,
  content,
  design,
}: {
  title: string | undefined;
  content: string | undefined;
  design: WidgetDesign;
}) => {
  const [activePage, setActivePage] = useState(0);
  // 기본값은 "최대" — 실제 위젯을 홈 화면에 크게 배치하는 사용자가 많아, 가장 넓은 상태를
  // 기본으로 보여주는 편이 실제 디자인 결과에 가깝다.
  const [sizePresetIndex, setSizePresetIndex] = useState(SIZE_PRESETS.length - 1);
  const extracted = useMemo(
    () => (content ? extractContent(content) : { index: '', content: '' }),
    [content],
  );
  const size = sizeForPreset(sizePresetIndex);
  // 스와이프 컨테이너(프레임/스크롤뷰/페이지)의 너비는 항상 "최대" 프리셋 기준으로 고정한다.
  // 프리셋 변경 시 이 너비까지 함께 바뀌면 ScrollView의 contentOffset이 새 페이지 경계와
  // 어긋나(카드형을 보는 중 크기를 바꾸면 배너형이 왼쪽에 걸쳐 보이는 문제) 자동으로 재동기화되지 않는다.
  // 배너형은 어떤 프리셋에서도 카드형보다 항상 넓으므로, 최대 배너 너비를 프레임 너비로 고정하면
  // 내부 카드/배너만 자신의 width prop만큼 커지고 프레임 자체는 그대로라 스크롤 위치가 틀어지지 않는다.
  const maxSize = sizeForPreset(SIZE_PRESETS.length - 1);
  const pageWidth = maxSize.bannerWidth + PAGE_MARGIN;

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setActivePage(page);
  };

  return (
    <View style={[styles.frame, { width: pageWidth }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={[styles.scrollView, { width: pageWidth }]}
      >
        <View style={[styles.page, { width: pageWidth }]}>
          <BannerPreview
            title={title ?? ''}
            index={extracted.index}
            content={extracted.content}
            design={design}
            width={size.bannerWidth}
            height={size.height}
          />
        </View>
        <View style={[styles.page, { width: pageWidth }]}>
          <CardPreview
            title={title ?? ''}
            index={extracted.index}
            content={extracted.content}
            design={design}
            width={size.cardWidth}
            height={size.height}
          />
        </View>
      </ScrollView>
      <View style={styles.indicatorRow}>
        <View style={[styles.dot, activePage === 0 && styles.dotActive]} />
        <View style={[styles.dot, activePage === 1 && styles.dotActive]} />
      </View>

      {/* 위젯 크기(리사이즈) 미리보기 — Android는 홈 화면에서 위젯을 가로/세로로 늘릴 수 있어
          늘렸을 때 텍스트/배경이 어떻게 보이는지 미리 확인 가능하게 한다. */}
      <View style={styles.sizePresetRow}>
        {SIZE_PRESETS.map((preset, i) => {
          const selected = i === sizePresetIndex;
          return (
            <TouchableOpacity key={preset.key} onPress={() => setSizePresetIndex(i)} style={styles.sizePresetButton}>
              <Text style={[styles.sizePresetText, selected && styles.sizePresetTextActive]}>{preset.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
  },
  scrollView: {
    height: FRAME_HEIGHT,
  },
  page: {
    height: FRAME_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardRadius: {
    borderRadius: 15,
  },
  textOnPhotoShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    paddingBottom: 4,
  },
  // 배너형(Large)
  bannerCard: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  bannerInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  bannerTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 6,
  },
  bannerContentText: {
    lineHeight: 22,
  },
  bannerIndexText: {
    fontSize: 11,
    opacity: 0.75,
    marginTop: 4,
  },
  // 카드형(Small) — 이중 레이어
  cardOuter: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  cardOuterWhite: {
    borderRadius: 15,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  cardTitleDark: {
    minHeight: CARD_TITLE_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'Pretendard-Bold',
  },
  cardTitleOnPhoto: {
    minHeight: CARD_TITLE_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'Pretendard-Bold',
  },
  // 사진 배경 위, 제목이 놓이는 바깥 영역에 얹는 반투명 검정 스크림 — 본문 카드 안쪽은 스크림 없이 사진이 그대로 비친다.
  cardTitleOnPhotoScrim: {
    backgroundColor: `rgba(0,0,0,${GALLERY_SCRIM_OPACITY})`,
  },
  cardInner: {
    flex: 1,
    marginHorizontal: CARD_INNER_MARGIN,
    marginBottom: CARD_INNER_MARGIN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    overflow: 'hidden',
  },
  cardInnerRadius: {
    borderRadius: 10,
  },
  cardContentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  cardIndexText: {
    fontSize: 11,
    opacity: 0.75,
    marginTop: 2,
    marginBottom: 6,
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
  sizePresetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  sizePresetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sizePresetText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'Pretendard-Bold',
  },
  sizePresetTextActive: {
    color: 'white',
  },
});

export default WidgetPreview;
