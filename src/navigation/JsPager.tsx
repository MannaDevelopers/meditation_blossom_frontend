/**
 * JsPager.tsx
 *
 * react-native-pager-view(RNCViewPager) 네이티브 모듈 없이 동작하는 순수 JS 페이저.
 * react-native-tab-view의 PanResponderAdapter를 로컬 복사하여 사용.
 * Metro의 package exports 제한으로 내부 경로 직접 임포트가 불가하기 때문.
 *
 * 출처: node_modules/react-native-tab-view/lib/module/PanResponderAdapter.js
 * 의존성: use-latest-callback (이미 설치됨)
 */
import * as React from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import useLatestCallback from 'use-latest-callback';
import logger from '../utils/logger';

// ─── 로컬 useAnimatedValue ───────────────────────────────────────────────────

function useAnimatedValue(initialValue: number): Animated.Value {
  const lazyRef = React.useRef<Animated.Value | undefined>(undefined);
  if (lazyRef.current === undefined) {
    lazyRef.current = new Animated.Value(initialValue);
  }
  return lazyRef.current;
}

// ─── Route / NavigationState 최소 타입 ──────────────────────────────────────

type Route = { key: string };

type NavigationState<T extends Route> = {
  index: number;
  routes: T[];
};

type EventEmitterProps = {
  addEnterListener: (listener: (value: number) => void) => () => void;
};

type PagerRendererProps = EventEmitterProps & {
  position: Animated.AnimatedInterpolation<number> | Animated.Value;
  jumpTo: (key: string) => void;
  render: (children: React.ReactNode) => React.ReactElement;
};

type PagerAdapterProps<T extends Route> = {
  layout: { width: number; height: number };
  keyboardDismissMode?: 'none' | 'on-drag' | 'auto';
  swipeEnabled?: boolean;
  navigationState: NavigationState<T>;
  onIndexChange: (index: number) => void;
  onTabSelect?: (props: { index: number }) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  children: (props: PagerRendererProps) => React.ReactElement;
  style?: StyleProp<ViewStyle>;
  animationEnabled?: boolean;
  layoutDirection?: 'ltr' | 'rtl';
  // Android-only prop, unused on JS pager
  overScrollMode?: string;
};

// ─── PanResponderAdapter (JS 페이저) ─────────────────────────────────────────

const DEAD_ZONE = 12;

const DefaultTransitionSpec = {
  timing: Animated.spring,
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
};

export function JsPager<T extends Route>({
  layout,
  keyboardDismissMode = 'auto',
  swipeEnabled = true,
  navigationState,
  onIndexChange,
  onTabSelect,
  onSwipeStart,
  onSwipeEnd,
  children,
  style,
  animationEnabled = false,
  layoutDirection = 'ltr',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overScrollMode: _overScrollMode,
}: PagerAdapterProps<T>): React.ReactElement {
  const { routes, index } = navigationState;
  const panX = useAnimatedValue(0);

  // Fabric(New Architecture) display:none→flex 워크어라운드:
  // 초기 렌더 시 focused tab(tab 0)을 포함한 모든 탭을 display:none으로 시작하고,
  // useLayoutEffect(first paint 이전)에서 focused tab을 absoluteFill로 전환한다.
  // 이렇게 하면 매일 만나 탭(처음 전환 시 display:none→flex)과 동일한 메커니즘이
  // 주일 말씀 탭(초기 탭)에도 적용되어 Fabric이 컨텐츠를 올바르게 커밋한다.
  const [displayFixed, setDisplayFixed] = React.useState(false);
  React.useLayoutEffect(() => {
    setDisplayFixed(true);
  }, []);

  // 레이아웃 경로 진단 로그 (layout.width 변경 시에만)
  const prevLayoutWidthRef = React.useRef<number>(-1);
  if (layout.width !== prevLayoutWidthRef.current) {
    prevLayoutWidthRef.current = layout.width;
    logger.log(
      '[JsPager] layout.width=' + layout.width +
      ' → path=' + (layout.width ? 'side-by-side' : 'absoluteFill') +
      ', index=' + index,
    );
  }
  const listenersRef = React.useRef<((value: number) => void)[]>([]);
  const navigationStateRef = React.useRef(navigationState);
  const layoutRef = React.useRef(layout);
  const onIndexChangeRef = React.useRef(onIndexChange);
  const onTabSelectRef = React.useRef(onTabSelect);
  const currentIndexRef = React.useRef(index);
  const pendingIndexRef = React.useRef<number | undefined>(undefined);

  const swipeVelocityThreshold = 0.15;
  const swipeDistanceThreshold = layout.width / 1.75;

  const jumpToIndex = useLatestCallback((idx: number, animate = animationEnabled) => {
    const offset = -idx * layoutRef.current.width;
    const { timing, ...transitionConfig } = DefaultTransitionSpec;
    if (animate) {
      Animated.parallel([
        timing(panX, { ...transitionConfig, toValue: offset, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (finished) {
          onIndexChangeRef.current(idx);
          onTabSelectRef.current?.({ index: idx });
          pendingIndexRef.current = undefined;
        }
      });
      pendingIndexRef.current = idx;
    } else {
      panX.setValue(offset);
      onIndexChangeRef.current(idx);
      onTabSelectRef.current?.({ index: idx });
      pendingIndexRef.current = undefined;
    }
  });

  React.useEffect(() => {
    navigationStateRef.current = navigationState;
    layoutRef.current = layout;
    onIndexChangeRef.current = onIndexChange;
    onTabSelectRef.current = onTabSelect;
  });

  React.useLayoutEffect(() => {
    const offset = -navigationStateRef.current.index * layout.width;
    panX.setValue(offset);
  }, [layout.width, panX]);

  React.useEffect(() => {
    if (keyboardDismissMode === 'auto') {
      Keyboard.dismiss();
    }
    if (layout.width && currentIndexRef.current !== index) {
      currentIndexRef.current = index;
      jumpToIndex(index);
    }
  }, [jumpToIndex, keyboardDismissMode, layout.width, index]);

  const isMovingHorizontally = (_: unknown, gestureState: { dx: number; dy: number; vx: number; vy: number }) =>
    Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 2) &&
    Math.abs(gestureState.vx) > Math.abs(gestureState.vy * 2);

  const canMoveScreen = (event: unknown, gestureState: { dx: number; dy: number; vx: number; vy: number }) => {
    if (swipeEnabled === false) return false;
    const diffX = layoutDirection === 'rtl' ? -gestureState.dx : gestureState.dx;
    return (
      isMovingHorizontally(event, gestureState) &&
      ((diffX >= DEAD_ZONE && currentIndexRef.current > 0) ||
        (diffX <= -DEAD_ZONE && currentIndexRef.current < routes.length - 1))
    );
  };

  const startGesture = () => {
    onSwipeStart?.();
    if (keyboardDismissMode === 'on-drag') Keyboard.dismiss();
    panX.stopAnimation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    panX.setOffset((panX as any)._value);
  };

  const respondToGesture = (_: unknown, gestureState: { dx: number }) => {
    const diffX = layoutDirection === 'rtl' ? -gestureState.dx : gestureState.dx;
    if ((diffX > 0 && index <= 0) || (diffX < 0 && index >= routes.length - 1)) return;
    if (layout.width) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const position = ((panX as any)._offset + diffX) / -layout.width;
      const next = position > index ? Math.ceil(position) : Math.floor(position);
      if (next !== index) listenersRef.current.forEach(l => l(next));
    }
    panX.setValue(diffX);
  };

  const finishGesture = (_: unknown, gestureState: { dx: number; dy: number; vx: number; vy: number }) => {
    panX.flattenOffset();
    onSwipeEnd?.();
    const currentIndex =
      typeof pendingIndexRef.current === 'number'
        ? pendingIndexRef.current
        : currentIndexRef.current;
    let nextIndex = currentIndex;
    if (
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
      Math.abs(gestureState.vx) > Math.abs(gestureState.vy) &&
      (Math.abs(gestureState.dx) > swipeDistanceThreshold ||
        Math.abs(gestureState.vx) > swipeVelocityThreshold)
    ) {
      nextIndex = Math.round(
        Math.min(
          Math.max(
            0,
            layoutDirection === 'rtl'
              ? currentIndex + gestureState.dx / Math.abs(gestureState.dx)
              : currentIndex - gestureState.dx / Math.abs(gestureState.dx),
          ),
          routes.length - 1,
        ),
      );
      currentIndexRef.current = nextIndex;
    }
    if (!isFinite(nextIndex)) nextIndex = currentIndex;
    jumpToIndex(nextIndex, true);
  };

  const addEnterListener = useLatestCallback((listener: (value: number) => void) => {
    listenersRef.current.push(listener);
    return () => {
      const i = listenersRef.current.indexOf(listener);
      if (i > -1) listenersRef.current.splice(i, 1);
    };
  });

  const jumpTo = useLatestCallback((key: string) => {
    const i = navigationStateRef.current.routes.findIndex(r => r.key === key);
    jumpToIndex(i);
    onIndexChange(i);
  });

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: canMoveScreen,
    onMoveShouldSetPanResponderCapture: canMoveScreen,
    onPanResponderGrant: startGesture,
    onPanResponderMove: respondToGesture,
    onPanResponderTerminate: finishGesture,
    onPanResponderRelease: finishGesture,
    onPanResponderTerminationRequest: () => true,
  });

  const position = React.useMemo(
    () => (layout.width ? Animated.divide(panX, -layout.width) : null),
    [layout.width, panX],
  );

  // Animated.View + transform 방식을 사용하지 않고 display:'none'으로 비활성 탭을 숨긴다.
  // Fabric(New Architecture)에서 Animated.View + transform을 사용하면 초기 렌더 시
  // 콘텐츠가 표시되지 않는 버그가 있어(탭 전환 후에야 표시됨), 이를 우회하기 위해
  // absoluteFill + display:'none' 방식을 채택한다.
  // PanResponder는 스와이프 제스처 감지를 위해 유지하되, 시각적 애니메이션은
  // display 전환(즉시 전환)으로 처리된다.
  return children({
    position: position ?? new Animated.Value(index),
    addEnterListener,
    jumpTo,
    render: (childrenNodes) => (
      <View
        style={[styles.sheet, style]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          logger.log('[JsPager] View onLayout: width=' + width + ', height=' + height);
        }}
        {...panResponder.panHandlers}
      >
        {React.Children.map(childrenNodes, (child, i) => {
          const route = routes[i];
          const focused = i === index;
          // displayFixed=false: 모든 탭 hidden (초기 렌더 - paint 이전)
          // displayFixed=true: focused 탭만 absoluteFill, 나머지 hidden
          const visible = displayFixed && focused;
          return (
            <View
              key={route.key}
              style={visible ? StyleSheet.absoluteFill : styles.hiddenTab}
            >
              {child}
            </View>
          );
        })}
      </View>
    ),
  });
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    overflow: 'hidden',
  },
  hiddenTab: {
    display: 'none',
  },
});

// Metro resolveRequest 리다이렉트용 별칭:
// ios/Pager.ios.js → JsPager.tsx 로 교체될 때 named export가 일치해야 함
export { JsPager as Pager };
export { JsPager as PanResponderAdapter };
