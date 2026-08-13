import { DEFAULT_WIDGET_DESIGN } from '../src/types/WidgetDesign';
import {
  WIDGET_TEXT_COLOR_PRESETS,
  WIDGET_BACKGROUND_COLOR_PRESETS,
} from '../src/constants';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

describe('DEFAULT_WIDGET_DESIGN', () => {
  it('기획 문서(#169) 기준 기본값을 갖는다', () => {
    expect(DEFAULT_WIDGET_DESIGN).toEqual({
      text: { align: 'center', color: '#000000', size: 20, weight: 'bold' },
      background: { type: 'color', value: 'gradient-default' },
    });
  });
});

describe.each([
  ['WIDGET_TEXT_COLOR_PRESETS', WIDGET_TEXT_COLOR_PRESETS],
  ['WIDGET_BACKGROUND_COLOR_PRESETS', WIDGET_BACKGROUND_COLOR_PRESETS],
])('%s', (_name, presets) => {
  it('7개(사용자 지정 제외)로 구성된다', () => {
    expect(presets).toHaveLength(7);
  });

  it('모든 값이 6자리 hex 색상이다', () => {
    presets.forEach(color => {
      expect(color).toMatch(HEX_COLOR_REGEX);
    });
  });

  it('중복된 색상이 없다', () => {
    expect(new Set(presets).size).toBe(presets.length);
  });
});
