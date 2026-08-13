import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { extractContent } from '../utils/sermonParser';
import { WidgetDesign, WidgetImageTransform } from '../types/WidgetDesign';
import { WIDGET_TEXT_WEIGHT_FONT_FAMILY } from '../constants';
import { cardOuterTint } from '../utils/widgetDesignColor';
import { MIN_ZOOM, clampFocal, computeBaseScale, computeHalfExtent } from '../utils/imageCropMath';

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

// 카드형(배경색) 테두리/안쪽 카드의 명도 차이 — 파스텔처럼 이미 밝은 색은 cardOuterTint가
// 방향을 반전(어둡게)해서 처리하므로, 어느 쪽이든 이 정도 차이는 확보된다.
const CARD_BACKGROUND_LIGHTEN_DELTA = 22;
// 카드형 갤러리 배경의 테두리(액자) 부분에 덮는 반투명 흰색의 불투명도.
const CARD_PHOTO_BORDER_TINT_OPACITY = 0.55;

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

// 본문 행간은 글자 크기에 비례해서 늘어나야 한다 — 고정값이면 글자 크기를 키울 때
// (특히 카드형) 줄이 서로 겹쳐 보인다. 배너형/카드형이 같은 이 함수를 공유하므로
// 같은 옵션이면 두 미리보기의 글자 효과(두께·행간)가 항상 동일하게 보인다.
const CONTENT_LINE_HEIGHT_RATIO = 1.4;

function resolveTextStyle(design: WidgetDesign): TextStyle {
  return {
    textAlign: design.text.align,
    fontFamily: WIDGET_TEXT_WEIGHT_FONT_FAMILY[design.text.weight],
    fontSize: design.text.size,
    lineHeight: Math.round(design.text.size * CONTENT_LINE_HEIGHT_RATIO),
    color: design.text.color,
  };
}

// 배경 타입/값에 따른 렌더링 분기 — 두 프리뷰(배너형/카드형) 공통 판별 로직
function resolveBackgroundKind(design: WidgetDesign): 'gallery' | 'default-gradient' | 'solid' {
  if (design.background.type === 'gallery') return 'gallery';
  if (design.background.value === 'gradient-default') return 'default-gradient';
  return 'solid';
}

// ImageCropScreen(배경 위치 조정)에서 저장한 zoom/focalX/focalY를 기준으로, 주어진 프레임(width×height)
// 안에서 이미지가 어디에 어떤 크기로 그려져야 하는지 계산한다. ImageCropScreen과 동일하게 "cover"
// 기준 배율(computeBaseScale) 위에 zoom을 곱하고, 포커스 포인트가 프레임 중심에 오도록 좌표를 구한다.
// 카드형처럼 같은 사진을 두 레이어(테두리 전체 + 안쪽 카드 창)로 겹쳐 그려야 할 때, 두 레이어가
// 독립적으로 각자의 프레임 기준 "cover fit"을 계산하면 서로 다른 배율/위치로 어긋나 사진이 이어지지
// 않고 잘린 것처럼 보인다 — 이 훅으로 계산을 한 곳에 모아 두 레이어가 정확히 같은 값을 공유하게 한다.
function useGalleryImageLayout(
  uri: string | undefined,
  transform: WidgetImageTransform | undefined,
  width: number,
  height: number,
) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!uri) {
      setImageSize(null);
      return;
    }
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
  const rawFocalX = transform?.focalX ?? 0.5;
  const rawFocalY = transform?.focalY ?? 0.5;

  const baseScale = imageSize ? computeBaseScale(imageSize.width, imageSize.height, width, height) : 0;
  const displayedWidth = imageSize ? imageSize.width * baseScale * zoom : 0;
  const displayedHeight = imageSize ? imageSize.height * baseScale * zoom : 0;
  // ImageCropScreen에서 저장한 focalX/focalY는 그 화면 프레임(항상 245:115 비율)에서만 여백
  // 없이 채워지도록 clamp된 값이다. 배너형/카드형(프리셋별로 폭·높이 비율이 달라짐)이나
  // iOS Large(거의 정사각형)처럼 전혀 다른 비율의 프레임에 그대로 재사용하면, 크롭 화면에서는
  // 유효했던 가장자리 위치가 이 프레임 기준으로는 이미지 밖을 가리켜 위/아래(또는 좌/우)에
  // 빈 공간이 보이는 문제가 있었다 — 지금 프레임 기준으로 다시 clamp해서 항상 꽉 채워지게 한다.
  const focalX = clampFocal(rawFocalX, computeHalfExtent(width, displayedWidth));
  const focalY = clampFocal(rawFocalY, computeHalfExtent(height, displayedHeight));
  const imageLeft = width / 2 - focalX * displayedWidth;
  const imageTop = height / 2 - focalY * displayedHeight;

  return { ready: imageSize !== null, displayedWidth, displayedHeight, imageLeft, imageTop };
}

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
  const layout = useGalleryImageLayout(uri, transform, width, height);

  return (
    <View style={[{ width, height, overflow: 'hidden' }, style]}>
      {layout.ready && (
        <Image
          source={{ uri }}
          style={{
            position: 'absolute',
            left: layout.imageLeft,
            top: layout.imageTop,
            width: layout.displayedWidth,
            height: layout.displayedHeight,
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
        style={[
          styles.bannerTitle,
          { color: design.text.color, fontSize: design.text.size },
          onPhoto && styles.textOnPhotoShadow,
        ]}
      >
        {title}
      </Text>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
        <Text allowFontScaling={false} style={[textStyle, onPhoto && styles.textOnPhotoShadow]}>
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

// 카드형(Small) 갤러리 배경의 "액자" 테두리 — 바깥 둥근 사각형(카드 전체)에서 안쪽 둥근
// 사각형(cardInner와 같은 위치·반경)을 뺀 도넛 모양을 SVG 마스크로 그린다. View 4장을
// 이어붙이는 방식은 안쪽 모서리가 각지게 뚫려 아래의 둥근 cardInner와 어긋나 보인다.
const CardPhotoFrame = ({ width, height }: { width: number; height: number }) => {
  const innerLeft = CARD_INNER_MARGIN;
  const innerTop = CARD_TITLE_HEIGHT;
  const innerWidth = width - CARD_INNER_MARGIN * 2;
  const innerHeight = height - CARD_TITLE_HEIGHT - CARD_INNER_MARGIN;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Mask id="cardPhotoFrameMask">
          <Rect x={0} y={0} width={width} height={height} rx={15} ry={15} fill="white" />
          <Rect x={innerLeft} y={innerTop} width={innerWidth} height={innerHeight} rx={10} ry={10} fill="black" />
        </Mask>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="white"
        fillOpacity={CARD_PHOTO_BORDER_TINT_OPACITY}
        mask="url(#cardPhotoFrameMask)"
      />
    </Svg>
  );
};

// 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절):
// - 배경색: 제목 영역은 본문 카드보다 밝은 동일 계열 톤 (배너형과 구분되도록)
// - 배경 갤러리: 기존 카드형(흰 테두리 + 안쪽 카드) 골격은 그대로 유지하고, 사진을 전체 배경으로
//   깐 뒤 테두리(제목 영역 포함) 자리에만 반투명 흰색을 "액자"처럼 덮는다. 안쪽 카드 영역은
//   덮개 없이 사진이 그대로 선명하게 보인다.
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

  // 카드형 갤러리 배경은 테두리(전체)와 안쪽 카드(창) 두 레이어에 "같은 사진"을 그려야 한다.
  // 두 레이어가 각자 따로 cover-fit을 계산하면 서로 다른 배율/위치로 어긋나 사진이 잘려
  // 보이므로, 이 훅으로 배율·위치를 한 번만 계산해 두 레이어가 정확히 같은 값을 공유하게 한다.
  const galleryUri = backgroundKind === 'gallery' ? design.background.value : undefined;
  const galleryLayout = useGalleryImageLayout(galleryUri, design.background.imageTransform, width, height);

  const body = (
    <>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
        <Text allowFontScaling={false} style={textStyle}>
          {content}
        </Text>
      </ScrollView>
      <Text allowFontScaling={false} style={[styles.cardIndexText, textStyle]}>
        {index}
      </Text>
    </>
  );

  if (backgroundKind === 'gallery') {
    // 안쪽 카드(cardInner) 레이어는 테두리 레이어와 동일한 imageLeft/Top/displayedWidth/Height를
    // 쓰되, cardInner 자신의 원점(제목 높이·좌우 여백만큼 안쪽으로 들어간 지점)을 기준으로 좌표만
    // 다시 잡는다 — 그래서 시각적으로는 하나로 이어진 사진 위에 "둥근 창"만 낸 것처럼 보인다.
    const innerOffsetX = CARD_INNER_MARGIN;
    const innerOffsetY = CARD_TITLE_HEIGHT;
    return (
      <View style={[styles.cardOuter, sizeStyle]}>
        {galleryLayout.ready && (
          <Image
            source={{ uri: design.background.value }}
            style={{
              position: 'absolute',
              left: galleryLayout.imageLeft,
              top: galleryLayout.imageTop,
              width: galleryLayout.displayedWidth,
              height: galleryLayout.displayedHeight,
            }}
          />
        )}
        {/* 기존 카드형(흰 테두리 + 안쪽 카드) 골격은 유지하면서, 테두리(제목 영역 포함) 자리에만
            반투명 흰색을 덮어 "액자" 느낌을 준다. 안쪽 카드 영역은 사진이 그대로 선명하게 보인다.
            사각형 4장을 이어붙이면 모서리가 각지게 뚫려 아래 둥근 안쪽 카드와 어긋나 보이므로,
            SVG 마스크로 "바깥 둥근 사각형에서 안쪽 둥근 사각형을 뺀 도넛" 모양을 한 번에 그린다. */}
        <CardPhotoFrame width={width} height={height} />
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.cardTitleOnPhoto,
            { color: design.text.color, fontSize: design.text.size },
            styles.textOnPhotoShadow,
          ]}
        >
          {title}
        </Text>
        {/* 안쪽 카드 내용(사진+텍스트)을 MaskedView로 감싼다 — cardInner의 overflow:'hidden'만으로는
            안드로이드에서 이 카드보다 훨씬 큰(커버 배율로 확대된) 절대 위치 사진 자식이 부모의
            둥근 모서리로 제대로 잘리지 않아 모서리가 각지게 보이는 문제가 있었다. */}
        <MaskedView style={styles.cardInner} maskElement={<View style={styles.cardInnerMask} />}>
          {galleryLayout.ready && (
            <Image
              source={{ uri: design.background.value }}
              style={{
                position: 'absolute',
                left: galleryLayout.imageLeft - innerOffsetX,
                top: galleryLayout.imageTop - innerOffsetY,
                width: galleryLayout.displayedWidth,
                height: galleryLayout.displayedHeight,
              }}
            />
          )}
          <View style={styles.cardInnerContent}>
            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
              <Text allowFontScaling={false} style={[textStyle, styles.textOnPhotoShadow]}>
                {content}
              </Text>
            </ScrollView>
            <Text allowFontScaling={false} style={[styles.cardIndexText, textStyle, styles.textOnPhotoShadow]}>
              {index}
            </Text>
          </View>
        </MaskedView>
      </View>
    );
  }

  if (backgroundKind === 'default-gradient') {
    return (
      <View style={[styles.cardOuterWhite, sizeStyle]}>
        <Text allowFontScaling={false} numberOfLines={2} style={[styles.cardTitleDark, { color: design.text.color, fontSize: design.text.size }]}>
          {title}
        </Text>
        <ImageBackground source={CARD_INDEX_GRADIENT} style={styles.cardInner} imageStyle={styles.cardInnerRadius}>
          <View style={styles.cardInnerContent}>{body}</View>
        </ImageBackground>
      </View>
    );
  }

  const solidColor = (design.background as { value: string }).value;
  const titleTint = cardOuterTint(solidColor, CARD_BACKGROUND_LIGHTEN_DELTA);

  return (
    <View style={[styles.cardOuterWhite, sizeStyle, { backgroundColor: titleTint }]}>
      <Text allowFontScaling={false} numberOfLines={2} style={[styles.cardTitleDark, { color: design.text.color, fontSize: design.text.size }]}>
        {title}
      </Text>
      <View style={[styles.cardInner, { backgroundColor: solidColor }]}>
        <View style={styles.cardInnerContent}>{body}</View>
      </View>
    </View>
  );
};

type WidgetPreviewProps = {
  title: string | undefined;
  content: string | undefined;
  design: WidgetDesign;
};

const AndroidWidgetPreview = ({ title, content, design }: WidgetPreviewProps) => {
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

// iOS WidgetKit(MeditationBlossomWidget.swift)은 Android Glance와 달리 배너/카드 구분이나
// 사용자 리사이즈가 없다 — .systemMedium / .systemLarge 두 고정 크기만 지원한다(supportedFamilies).
// 실제 위젯 자산 크기(background_364_170 / background_364_382)를 기준으로 비율을 그대로 따르고,
// 미리보기 폭만 화면에 맞춰 축소한다.
const IOS_NATIVE_WIDTH = 364;
const IOS_NATIVE_MEDIUM_HEIGHT = 170;
const IOS_NATIVE_LARGE_HEIGHT = 382;
const IOS_PREVIEW_WIDTH = Math.min(SCREEN_WIDTH - 70, 340);
const IOS_PREVIEW_SCALE = IOS_PREVIEW_WIDTH / IOS_NATIVE_WIDTH;
const IOS_MEDIUM_HEIGHT = Math.round(IOS_NATIVE_MEDIUM_HEIGHT * IOS_PREVIEW_SCALE);
const IOS_LARGE_HEIGHT = Math.round(IOS_NATIVE_LARGE_HEIGHT * IOS_PREVIEW_SCALE);
const iosScaled = (n: number) => Math.round(n * IOS_PREVIEW_SCALE);

// 구분선만 실제 위젯(MeditationBlossomWidgetEntryView)과 동일한 고정 톤 — 제목/장절/본문은
// design.text(색상·크기)를 따른다.
const IOS_WIDGET_COLORS = {
  divider: 'rgba(26,26,26,0.12)',
};

type IOSWidgetFamily = 'medium' | 'large';

const IOSWidgetFrame = ({
  family,
  title,
  index,
  content,
  design,
}: PreviewText & { family: IOSWidgetFamily; design: WidgetDesign }) => {
  const width = IOS_PREVIEW_WIDTH;
  const height = family === 'large' ? IOS_LARGE_HEIGHT : IOS_MEDIUM_HEIGHT;
  const textStyle = resolveTextStyle(design);
  const backgroundKind = resolveBackgroundKind(design);
  const onPhoto = backgroundKind === 'gallery';
  const hasVerse = index.trim().length > 0;

  // 제목/장절도 본문처럼 사용자가 고른 텍스트 색상·크기를 따른다 — 굵기(제목: Bold,
  // 장절: SemiBold)만 실제 위젯처럼 고정.
  const dividerColor = onPhoto ? 'rgba(255,255,255,0.4)' : IOS_WIDGET_COLORS.divider;

  const inner =
    family === 'large' ? (
      <View
        style={{
          flex: 1,
          paddingHorizontal: iosScaled(24),
          paddingTop: iosScaled(18),
          paddingBottom: iosScaled(18),
        }}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.iosTitle,
            { fontSize: design.text.size, color: design.text.color },
            onPhoto && styles.textOnPhotoShadow,
          ]}
        >
          {title}
        </Text>
        {hasVerse && (
          <Text
            allowFontScaling={false}
            style={[
              styles.iosVerse,
              { fontSize: design.text.size, color: design.text.color, marginTop: iosScaled(6) },
              onPhoto && styles.textOnPhotoShadow,
            ]}
          >
            {index}
          </Text>
        )}
        <View style={[styles.iosDivider, { backgroundColor: dividerColor, marginTop: iosScaled(10) }]} />
        <ScrollView
          style={[styles.contentScroll, { marginTop: iosScaled(10) }]}
          contentContainerStyle={styles.contentScrollInner}
        >
          <Text allowFontScaling={false} style={[textStyle, onPhoto && styles.textOnPhotoShadow]}>
            {content}
          </Text>
        </ScrollView>
      </View>
    ) : (
      <View
        style={{
          flex: 1,
          paddingHorizontal: iosScaled(18),
          paddingTop: iosScaled(18),
          paddingBottom: iosScaled(18),
        }}
      >
        <View style={styles.iosMediumHeaderRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.iosTitle,
              { fontSize: design.text.size, color: design.text.color, flexShrink: 1 },
              onPhoto && styles.textOnPhotoShadow,
            ]}
          >
            {title}
          </Text>
          {hasVerse && (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.iosVerse,
                { fontSize: design.text.size, color: design.text.color, marginLeft: iosScaled(4) },
                onPhoto && styles.textOnPhotoShadow,
              ]}
            >
              {index}
            </Text>
          )}
        </View>
        <View style={[styles.iosDivider, { backgroundColor: dividerColor, marginTop: iosScaled(8) }]} />
        <ScrollView
          style={[styles.contentScroll, { marginTop: iosScaled(8) }]}
          contentContainerStyle={styles.contentScrollInner}
        >
          <Text allowFontScaling={false} style={[textStyle, onPhoto && styles.textOnPhotoShadow]}>
            {content}
          </Text>
        </ScrollView>
      </View>
    );

  if (backgroundKind === 'gallery') {
    return (
      <GalleryBackground
        uri={design.background.value}
        transform={design.background.imageTransform}
        width={width}
        height={height}
        style={styles.iosFrame}
      >
        {inner}
      </GalleryBackground>
    );
  }

  if (backgroundKind === 'default-gradient') {
    return (
      <ImageBackground
        source={CARD_INDEX_GRADIENT}
        style={[styles.iosFrame, { width, height }]}
        imageStyle={styles.cardRadius}
      >
        {inner}
      </ImageBackground>
    );
  }

  return (
    <View
      style={[styles.iosFrame, { width, height, backgroundColor: (design.background as { value: string }).value }]}
    >
      {inner}
    </View>
  );
};

const IOSWidgetPreview = ({ title, content, design }: WidgetPreviewProps) => {
  const [activePage, setActivePage] = useState(0);
  const extracted = useMemo(
    () => (content ? extractContent(content) : { index: '', content: '' }),
    [content],
  );
  const pageWidth = IOS_PREVIEW_WIDTH + PAGE_MARGIN;
  const frameHeight = IOS_LARGE_HEIGHT;

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
        style={[styles.scrollView, { width: pageWidth, height: frameHeight }]}
      >
        <View style={[styles.page, { width: pageWidth, height: frameHeight }]}>
          <IOSWidgetFrame
            family="medium"
            title={title ?? ''}
            index={extracted.index}
            content={extracted.content}
            design={design}
          />
        </View>
        <View style={[styles.page, { width: pageWidth, height: frameHeight }]}>
          <IOSWidgetFrame
            family="large"
            title={title ?? ''}
            index={extracted.index}
            content={extracted.content}
            design={design}
          />
        </View>
      </ScrollView>
      <View style={styles.indicatorRow}>
        <View style={[styles.dot, activePage === 0 && styles.dotActive]} />
        <View style={[styles.dot, activePage === 1 && styles.dotActive]} />
      </View>
    </View>
  );
};

const WidgetPreview = (props: WidgetPreviewProps) =>
  Platform.OS === 'ios' ? <IOSWidgetPreview {...props} /> : <AndroidWidgetPreview {...props} />;

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
    fontFamily: 'Pretendard-Bold',
    marginBottom: 6,
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
  // 한 줄짜리 제목은 minHeight보다 낮아서, 패딩만으로는 위쪽에 치우쳐 보인다 — 카드 맨 위(테두리)와
  // 안쪽 카드 시작 지점 사이 정중앙에 오도록 textAlignVertical로 세로 중앙 정렬한다.
  cardTitleDark: {
    minHeight: CARD_TITLE_HEIGHT,
    paddingHorizontal: 12,
    fontFamily: 'Pretendard-Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cardTitleOnPhoto: {
    minHeight: CARD_TITLE_HEIGHT,
    paddingHorizontal: 12,
    fontFamily: 'Pretendard-Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cardInner: {
    flex: 1,
    marginHorizontal: CARD_INNER_MARGIN,
    marginBottom: CARD_INNER_MARGIN,
    borderRadius: 10,
    overflow: 'hidden',
  },
  // cardInner의 overflow:'hidden'만으로 안드로이드에서 잘 잘리지 않는 갤러리 배경(큰 절대
  // 위치 사진)을 위한 MaskedView 마스크 도형 — cardInner와 동일한 모서리 반경을 갖는다.
  cardInnerMask: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'black',
  },
  // cardInner 자체는 패딩을 갖지 않는다 — 갤러리 배경일 때 사진(Image)이 cardInner 전체를
  // 여백 없이 채워야 cardInner의 borderRadius가 사진에 그대로 적용되기 때문에, 텍스트 여백은
  // 이 안쪽 래퍼에서만 별도로 준다.
  cardInnerContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  cardInnerRadius: {
    borderRadius: 10,
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
  // iOS 위젯(systemMedium/systemLarge) 프레임 — Android처럼 배너/카드 이중 레이어가 아니라
  // 실제 MeditationBlossomWidgetEntryView와 같은 단일 레이어(제목-장절-구분선-본문) 구조.
  iosFrame: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  iosMediumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iosTitle: {
    fontFamily: 'Pretendard-Bold',
  },
  iosVerse: {
    fontFamily: 'Pretendard-SemiBold',
  },
  iosDivider: {
    height: 1,
  },
});

export default WidgetPreview;
