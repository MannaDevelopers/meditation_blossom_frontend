import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  clampFocal,
  clampZoom,
  computeBaseScale,
  computeHalfExtent,
  computePannedFocal,
} from '../utils/imageCropMath';

// Android Large 위젯 최소 크기 비율(245:115dp, [#169] 3.6절) — 배경 크롭 프레임 기준
const FRAME_ASPECT_RATIO = 245 / 115;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const FRAME_WIDTH = SCREEN_WIDTH - 80;
const FRAME_HEIGHT = FRAME_WIDTH / FRAME_ASPECT_RATIO;
const SLIDER_WIDTH = 220;

type Props = NativeStackScreenProps<RootStackParamList, 'ImageCropScreen'>;

const ZoomSlider = ({ zoom, onChange }: { zoom: number; onChange: (next: number) => void }) => {
  const startZoomRef = useRef(zoom);
  const ratio = (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);

  const pan = Gesture.Pan()
    .onStart(() => {
      startZoomRef.current = zoom;
    })
    .onUpdate(e => {
      const startRatio = (startZoomRef.current - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
      const nextRatio = Math.min(Math.max(startRatio + e.translationX / SLIDER_WIDTH, 0), 1);
      onChange(MIN_ZOOM + nextRatio * (MAX_ZOOM - MIN_ZOOM));
    });

  return (
    <View style={styles.sliderTrack}>
      <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
      <GestureDetector gesture={pan}>
        <View style={[styles.sliderThumb, { left: ratio * SLIDER_WIDTH - 10 }]} />
      </GestureDetector>
    </View>
  );
};

const ImageCropScreen = ({ navigation, route }: Props) => {
  const { imageUri, initialTransform } = route.params;

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [focalX, setFocalX] = useState(initialTransform?.focalX ?? 0.5);
  const [focalY, setFocalY] = useState(initialTransform?.focalY ?? 0.5);
  const [zoom, setZoom] = useState(clampZoom(initialTransform?.zoom ?? MIN_ZOOM));

  const panStartRef = useRef({ focalX, focalY });

  useEffect(() => {
    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(null),
    );
  }, [imageUri]);

  const baseScale = useMemo(
    () => (imageSize ? computeBaseScale(imageSize.width, imageSize.height, FRAME_WIDTH, FRAME_HEIGHT) : 0),
    [imageSize],
  );

  const displayedWidth = imageSize ? imageSize.width * baseScale * zoom : 0;
  const displayedHeight = imageSize ? imageSize.height * baseScale * zoom : 0;

  const applyZoom = (nextZoom: number) => {
    const clamped = clampZoom(nextZoom);
    setZoom(clamped);
    if (!imageSize) return;
    const nextDisplayedWidth = imageSize.width * baseScale * clamped;
    const nextDisplayedHeight = imageSize.height * baseScale * clamped;
    setFocalX(f => clampFocal(f, computeHalfExtent(FRAME_WIDTH, nextDisplayedWidth)));
    setFocalY(f => clampFocal(f, computeHalfExtent(FRAME_HEIGHT, nextDisplayedHeight)));
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      panStartRef.current = { focalX, focalY };
    })
    .onUpdate(e => {
      if (!imageSize || displayedWidth === 0 || displayedHeight === 0) return;
      const next = computePannedFocal({
        startFocalX: panStartRef.current.focalX,
        startFocalY: panStartRef.current.focalY,
        translationX: e.translationX,
        translationY: e.translationY,
        displayedWidth,
        displayedHeight,
        frameWidth: FRAME_WIDTH,
        frameHeight: FRAME_HEIGHT,
      });
      setFocalX(next.focalX);
      setFocalY(next.focalY);
    });

  const pinchStartZoomRef = useRef(zoom);
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchStartZoomRef.current = zoom;
    })
    .onUpdate(e => {
      applyZoom(pinchStartZoomRef.current * e.scale);
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const frameCenterX = SCREEN_WIDTH / 2;
  const frameCenterY = SCREEN_HEIGHT / 2;
  const imageLeft = frameCenterX - focalX * displayedWidth;
  const imageTop = frameCenterY - focalY * displayedHeight;

  const handleApply = () => {
    route.params.onApply({ zoom, focalX, focalY });
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const sideMaskWidth = (SCREEN_WIDTH - FRAME_WIDTH) / 2;
  const topMaskHeight = (SCREEN_HEIGHT - FRAME_HEIGHT) / 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {imageSize && (
        <Image
          source={{ uri: imageUri }}
          style={{
            position: 'absolute',
            left: imageLeft,
            top: imageTop,
            width: displayedWidth,
            height: displayedHeight,
          }}
        />
      )}

      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      {/* 프레임 바깥 마스킹 (반투명 검정) */}
      <View pointerEvents="none" style={[styles.mask, { top: 0, height: topMaskHeight, left: 0, right: 0 }]} />
      <View
        pointerEvents="none"
        style={[styles.mask, { bottom: 0, height: topMaskHeight, left: 0, right: 0 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.mask, { top: topMaskHeight, height: FRAME_HEIGHT, left: 0, width: sideMaskWidth }]}
      />
      <View
        pointerEvents="none"
        style={[styles.mask, { top: topMaskHeight, height: FRAME_HEIGHT, right: 0, width: sideMaskWidth }]}
      />

      {/* 프레임 테두리 + 코너 마커 */}
      <View
        pointerEvents="none"
        style={[
          styles.frameBorder,
          { top: topMaskHeight, left: sideMaskWidth, width: FRAME_WIDTH, height: FRAME_HEIGHT },
        ]}
      >
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
      </View>

      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={styles.topBarText}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>배경 위치 조정</Text>
        <TouchableOpacity onPress={handleApply} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={[styles.topBarText, styles.applyText]}>적용</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomBar} pointerEvents="box-none">
        <ZoomSlider zoom={zoom} onChange={applyZoom} />
        <Text style={styles.hintText}>손가락으로 확대·축소하거나 밀어서 위치를 조정하세요</Text>
      </View>
    </View>
  );
};

const CORNER_SIZE = 18;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  frameBorder: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: 'white',
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTopRight: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  topBarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topBarTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  applyText: {
    color: '#FFCD16',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  hintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  sliderTrack: {
    width: SLIDER_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFCD16',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
});

export default ImageCropScreen;
