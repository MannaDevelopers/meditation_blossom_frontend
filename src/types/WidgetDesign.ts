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

// 편집 기능 도입 전 실제 네이티브 위젯(VerseWidgetLarge/Small.kt, MeditationBlossomWidget.swift)의
// 하드코딩된 스타일을 그대로 옮긴 값 — "초기화"를 누르면 편집 이전과 동일한 위젯을 설치할 수 있어야
// 하므로, 두 플랫폼 모두 텍스트는 왼쪽 정렬·본문 Regular 두께·16sp/pt 기준이었다(제목만 Bold였지만
// 그 굵기는 title 자체에 고정 적용되고, weight 옵션은 본문에만 적용되므로 본문 기준으로 맞춘다).
export const DEFAULT_WIDGET_DESIGN: WidgetDesign = {
  text: { align: 'left', color: '#000000', size: 16, weight: 'regular' },
  background: { type: 'color', value: 'gradient-default' }, // 기존 위젯 그라데이션 배경과 동일
};
