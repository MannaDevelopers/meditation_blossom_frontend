import { processTitleText } from '../src/utils/textFormatting';

describe('processTitleText', () => {
  it('returns empty string for undefined', () => {
    expect(processTitleText(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(processTitleText('')).toBe('');
  });

  it('returns text unchanged when no parentheses', () => {
    expect(processTitleText('Hello World')).toBe('Hello World');
  });

  it('adds newline before opening parenthesis', () => {
    expect(processTitleText('Title (subtitle)')).toBe('Title \n(subtitle)');
  });

  it('handles multiple parentheses', () => {
    const result = processTitleText('A (B) C (D)');
    expect(result).toBe('A \n(B) C \n(D)');
  });
});
