import { getThemeColors, lightColors, darkColors } from '../src/theme/colors';

describe('getThemeColors', () => {
  it('dark 스킴이면 darkColors 반환', () => {
    expect(getThemeColors('dark')).toBe(darkColors);
  });

  it('light 스킴이면 lightColors 반환', () => {
    expect(getThemeColors('light')).toBe(lightColors);
  });

  it('null/undefined는 lightColors로 폴백', () => {
    expect(getThemeColors(null)).toBe(lightColors);
    expect(getThemeColors(undefined)).toBe(lightColors);
  });
});
