export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** 이미지가 프레임을 빈틈없이 채우는 최소 배율(zoom=1 기준 스케일) — CSS `background-size: cover`와 동일한 개념 */
export function computeBaseScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

export function clampZoom(zoom: number, min: number = MIN_ZOOM, max: number = MAX_ZOOM): number {
  return Math.min(Math.max(zoom, min), max);
}

/** 특정 축에서 포커스 포인트(0~1)가 움직일 수 있는 범위의 절반 폭 — 프레임이 이미지 경계를 벗어나지 않도록 함 */
export function computeHalfExtent(frameLength: number, displayedLength: number): number {
  if (displayedLength <= 0) return 0.5;
  return frameLength / 2 / displayedLength;
}

/** 포커스 포인트를 [halfExtent, 1-halfExtent] 범위로 clamp. halfExtent >= 0.5면 그 축은 여유가 없어 0.5(중앙) 고정 */
export function clampFocal(value: number, halfExtent: number): number {
  if (halfExtent >= 0.5) return 0.5;
  return Math.min(Math.max(value, halfExtent), 1 - halfExtent);
}

/** 드래그(팬) 제스처의 누적 translation(px)을 반영한 다음 포커스 포인트 계산 */
export function computePannedFocal(params: {
  startFocalX: number;
  startFocalY: number;
  translationX: number;
  translationY: number;
  displayedWidth: number;
  displayedHeight: number;
  frameWidth: number;
  frameHeight: number;
}): { focalX: number; focalY: number } {
  const { startFocalX, startFocalY, translationX, translationY, displayedWidth, displayedHeight, frameWidth, frameHeight } =
    params;

  const rawFocalX = startFocalX - translationX / displayedWidth;
  const rawFocalY = startFocalY - translationY / displayedHeight;

  return {
    focalX: clampFocal(rawFocalX, computeHalfExtent(frameWidth, displayedWidth)),
    focalY: clampFocal(rawFocalY, computeHalfExtent(frameHeight, displayedHeight)),
  };
}
