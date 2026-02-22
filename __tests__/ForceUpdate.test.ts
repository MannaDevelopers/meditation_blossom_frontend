import { compareVersions, needsForceUpdate } from '../src/types/ForceUpdate';

describe('compareVersions', () => {
  it('동일한 버전은 0을 반환', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.3.4', '2.3.4')).toBe(0);
  });

  it('patch 버전 비교', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('minor 버전 비교', () => {
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
  });

  it('major 버전 비교', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('major가 높으면 minor/patch가 낮아도 양수', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('세그먼트 수가 다른 경우 (부족한 세그먼트는 0으로 처리)', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });

  it('큰 버전 넘버 비교', () => {
    expect(compareVersions('10.20.30', '10.20.29')).toBe(1);
    expect(compareVersions('10.20.30', '10.20.31')).toBe(-1);
  });
});

describe('needsForceUpdate', () => {
  it('enabled가 false이면 항상 false', () => {
    expect(needsForceUpdate('0.0.1', '99.99.99', false)).toBe(false);
  });

  it('현재 버전이 최소 버전보다 낮으면 true', () => {
    expect(needsForceUpdate('1.0.0', '1.0.1', true)).toBe(true);
    expect(needsForceUpdate('1.0.0', '2.0.0', true)).toBe(true);
  });

  it('현재 버전이 최소 버전과 같으면 false', () => {
    expect(needsForceUpdate('1.0.0', '1.0.0', true)).toBe(false);
  });

  it('현재 버전이 최소 버전보다 높으면 false', () => {
    expect(needsForceUpdate('1.0.2', '1.0.1', true)).toBe(false);
    expect(needsForceUpdate('2.0.0', '1.9.9', true)).toBe(false);
  });
});
