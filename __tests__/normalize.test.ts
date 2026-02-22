import { normalizeJsonString } from '../src/utils/normalize';

describe('normalizeJsonString', () => {
  it('returns empty string for null', () => {
    expect(normalizeJsonString(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeJsonString(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeJsonString('')).toBe('');
  });

  it('normalizes simple JSON object', () => {
    const result = normalizeJsonString('{"b":1,"a":2}');
    expect(result).toBe('{"a":2,"b":1}');
  });

  it('produces identical output for equivalent objects with different key order', () => {
    const a = normalizeJsonString('{"x":1,"y":2}');
    const b = normalizeJsonString('{"y":2,"x":1}');
    expect(a).toBe(b);
  });

  it('normalizes nested objects', () => {
    const result = normalizeJsonString('{"b":{"d":1,"c":2},"a":3}');
    const parsed = JSON.parse(result!);
    expect(Object.keys(parsed)).toEqual(['a', 'b']);
  });

  it('normalizes line endings in strings', () => {
    const result = normalizeJsonString('{"text":"hello\\r\\nworld"}');
    expect(result).toContain('hello\\nworld');
  });

  it('returns null for invalid JSON', () => {
    expect(normalizeJsonString('not-json')).toBeNull();
  });

  it('normalizes arrays', () => {
    const result = normalizeJsonString('[{"b":1,"a":2},{"d":3,"c":4}]');
    expect(result).toBe('[{"a":2,"b":1},{"c":4,"d":3}]');
  });

  it('normalizes arrays with mixed types', () => {
    const result = normalizeJsonString('[1,"hello",{"b":2,"a":1}]');
    expect(result).toBe('[1,"hello",{"a":1,"b":2}]');
  });
});
