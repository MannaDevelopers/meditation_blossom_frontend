import { isPresetColor, getHexLightness, lightenHexColor } from '../src/utils/widgetDesignColor';

describe('isPresetColor', () => {
  const presets = ['#FF3B30', '#34C759'];

  it('프리셋에 포함된 hex는 true', () => {
    expect(isPresetColor('#FF3B30', presets)).toBe(true);
  });

  it('대소문자가 달라도 동일 색상이면 true', () => {
    expect(isPresetColor('#ff3b30', presets)).toBe(true);
  });

  it('프리셋에 없는 hex(사용자 지정)는 false', () => {
    expect(isPresetColor('#123456', presets)).toBe(false);
  });
});

describe('lightenHexColor', () => {
  it('명도를 delta만큼 올린다', () => {
    const original = '#808080'; // L=50
    const lightened = lightenHexColor(original, 18);
    expect(getHexLightness(lightened)).toBeCloseTo(68, 0);
  });

  it('95% 상한을 넘지 않는다', () => {
    const lightened = lightenHexColor('#2E2E2E', 80); // L=18 + 80 = 98 -> clamp 95
    expect(getHexLightness(lightened)).toBeLessThanOrEqual(95);
  });

  it('이미 밝은 색(흰색)은 95% 상한으로 살짝 눌릴 뿐 크게 달라지지 않는다', () => {
    const lightened = lightenHexColor('#FFFFFF', 18);
    expect(getHexLightness(lightened)).toBeCloseTo(95, 0);
  });

  it('색조를 유지한다 (빨강 계열은 여전히 빨강 계열)', () => {
    const lightened = lightenHexColor('#CC0000', 15);
    // 밝아진 빨강이므로 R 채널이 G/B보다 여전히 커야 한다
    const r = parseInt(lightened.slice(1, 3), 16);
    const g = parseInt(lightened.slice(3, 5), 16);
    const b = parseInt(lightened.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });
});
