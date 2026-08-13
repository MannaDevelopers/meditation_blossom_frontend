import { isPresetColor } from '../src/utils/widgetDesignColor';

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
