import { isSermonDataStale } from '../src/services/sermonService';

describe('isSermonDataStale', () => {
  it('returns true when sermonDate is null', () => {
    expect(isSermonDataStale(null)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isSermonDataStale(new Date())).toBe(false);
  });

  it('returns false for yesterday with default threshold', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isSermonDataStale(yesterday)).toBe(false);
  });

  it('returns true for date older than threshold', () => {
    const old = new Date();
    old.setDate(old.getDate() - 8);
    expect(isSermonDataStale(old, 7)).toBe(true);
  });

  it('returns true for date exactly at threshold', () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    expect(isSermonDataStale(cutoff, 7)).toBe(true);
  });

  it('respects custom threshold', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(isSermonDataStale(twoDaysAgo, 1)).toBe(true);
    expect(isSermonDataStale(twoDaysAgo, 3)).toBe(false);
  });
});
