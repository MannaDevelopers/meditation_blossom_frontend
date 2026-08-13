export type WidgetTextAlign = 'left' | 'center' | 'right';
export type WidgetTextSize = 16 | 20 | 24 | 28; // 작게/보통/크게/아주크게
export type WidgetTextWeight = 'regular' | 'bold' | 'extrabold';
export type WidgetBackgroundType = 'color' | 'gallery';

export interface WidgetImageTransform {
  zoom: number; // 1.0 = 이미지가 프레임을 빈틈없이 채우는 최소 배율, 최대 3.0
  focalX: number; // 0~1, 이미지 가로축에서 프레임 중심이 위치하는 지점
  focalY: number; // 0~1, 이미지 세로축에서 프레임 중심이 위치하는 지점
}

export interface WidgetDesign {
  text: {
    align: WidgetTextAlign;
    color: string; // hex, 프리셋 중 하나 또는 커스텀
    size: WidgetTextSize;
    weight: WidgetTextWeight;
  };
  background: {
    type: WidgetBackgroundType;
    value: string; // type='color'면 hex, type='gallery'면 원본(또는 다운스케일) 이미지 로컬 경로
    imageTransform?: WidgetImageTransform; // type='gallery'일 때만 존재
  };
}

export const DEFAULT_WIDGET_DESIGN: WidgetDesign = {
  text: { align: 'center', color: '#000000', size: 20, weight: 'bold' },
  background: { type: 'color', value: 'gradient-default' }, // 기존 미리보기 그라데이션 배경 유지
};
