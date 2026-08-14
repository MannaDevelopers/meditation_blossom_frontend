import { DEFAULT_WIDGET_DESIGN } from '../src/types/WidgetDesign';
import {
  WIDGET_TEXT_COLOR_PRESETS,
  WIDGET_BACKGROUND_COLOR_PRESETS,
} from '../src/constants';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

describe('DEFAULT_WIDGET_DESIGN', () => {
  it('편집 기능 도입 전 실제 네이티브 위젯(VerseWidgetLarge/Small.kt, MeditationBlossomWidget.swift)과 동일한 기본값을 갖는다', () => {
    // "초기화"를 누르면 편집 이전과 동일한 위젯을 설치할 수 있어야 하므로, 기획 문서의 추정값이 아니라
    // 실제 네이티브 코드의 하드코딩된 스타일(왼쪽 정렬·16sp/pt·본문 Regular)을 그대로 따른다.
    expect(DEFAULT_WIDGET_DESIGN).toEqual({
      text: { align: 'left', color: '#000000', size: 16, weight: 'regular' },
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
