import {
  computeBaseScale,
  clampZoom,
  computeHalfExtent,
  clampFocal,
  computePannedFocal,
} from '../src/utils/imageCropMath';

describe('computeBaseScale', () => {
  it('이미지 비율(2:1)이 프레임 비율(~2.13:1)보다 좁으면 가로 기준으로 채운다', () => {
    // 이미지 2000x1000 (2:1) vs 프레임 245x115 (~2.13:1) — 프레임이 상대적으로 더 납작해서
    // 가로를 프레임에 맞추면 세로는 자동으로 남게(cover) 되므로 가로 기준 스케일이 더 크다
    const scale = computeBaseScale(2000, 1000, 245, 115);
    expect(scale).toBeCloseTo(245 / 2000, 5);
  });

  it('세로가 더 긴 이미지는 가로 기준으로 채운다', () => {
    const scale = computeBaseScale(1000, 2000, 245, 115);
    expect(scale).toBeCloseTo(245 / 1000, 5);
  });
});

describe('clampZoom', () => {
  it('1~3 범위를 벗어나면 clamp', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(5)).toBe(3);
    expect(clampZoom(2)).toBe(2);
  });
});

describe('computeHalfExtent', () => {
  it('이미지가 프레임과 동일 크기면 0.5 (여유 없음)', () => {
    expect(computeHalfExtent(245, 245)).toBeCloseTo(0.5, 5);
  });

  it('이미지가 프레임보다 크면 0.5보다 작음 (팬 여유 있음)', () => {
    expect(computeHalfExtent(245, 490)).toBeCloseTo(0.25, 5);
  });
});

describe('clampFocal', () => {
  it('halfExtent가 0.5 이상이면 무조건 0.5 반환', () => {
    expect(clampFocal(0.9, 0.5)).toBe(0.5);
    expect(clampFocal(0.1, 0.6)).toBe(0.5);
  });

  it('범위 안의 값은 그대로 반환', () => {
    expect(clampFocal(0.4, 0.25)).toBe(0.4);
  });

  it('범위를 벗어나면 경계값으로 clamp', () => {
    expect(clampFocal(0.1, 0.25)).toBe(0.25);
    expect(clampFocal(0.9, 0.25)).toBe(0.75);
  });
});

describe('computePannedFocal', () => {
  const baseParams = {
    startFocalX: 0.5,
    startFocalY: 0.5,
    displayedWidth: 490, // frame(245)의 2배 크기로 표시 중 → halfExtent 0.25
    displayedHeight: 230, // frame(115)의 2배
    frameWidth: 245,
    frameHeight: 115,
  };

  it('오른쪽으로 드래그하면 focalX가 감소한다', () => {
    const { focalX } = computePannedFocal({ ...baseParams, translationX: 49, translationY: 0 });
    // 49px / 490px = 0.1 만큼 감소
    expect(focalX).toBeCloseTo(0.4, 5);
  });

  it('왼쪽으로 드래그하면 focalX가 증가한다', () => {
    const { focalX } = computePannedFocal({ ...baseParams, translationX: -49, translationY: 0 });
    expect(focalX).toBeCloseTo(0.6, 5);
  });

  it('과도하게 드래그해도 halfExtent 경계를 벗어나지 않는다', () => {
    const { focalX, focalY } = computePannedFocal({ ...baseParams, translationX: 10000, translationY: -10000 });
    expect(focalX).toBeCloseTo(0.25, 5);
    expect(focalY).toBeCloseTo(0.75, 5);
  });
});
