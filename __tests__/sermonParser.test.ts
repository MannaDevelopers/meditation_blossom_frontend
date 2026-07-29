import { extractContent } from '../src/utils/sermonParser';

describe('extractContent', () => {
  it('장절과 본문을 정상 분리한다', () => {
    const input = '로마서 3:23 모든 사람이 죄를 범하였으매';
    const result = extractContent(input);
    expect(result.index).toBe('로마서 3:23');
    expect(result.content).toBe('모든 사람이 죄를 범하였으매');
  });

  it('여러 절이 있을 때 각 절을 분리한다', () => {
    const input =
      '요한복음 3:16-17 16 하나님이 세상을 이처럼 사랑하사 17 하나님이 그 아들을 세상에 보내신 것은';
    const result = extractContent(input);
    expect(result.index).toBe('요한복음 3:16-17');
    expect(result.content).toContain('16 하나님이 세상을 이처럼 사랑하사');
    expect(result.content).toContain('17 하나님이 그 아들을 세상에 보내신 것은');
  });

  it('본문 없이 장절만 있으면 에러 메시지를 반환한다', () => {
    const result = extractContent('로마서 3:23');
    expect(result.index).toBe('로마서 3:23');
    expect(result.content).toBe('본문 내용을 찾을 수 없습니다.');
  });

  it('장절 패턴이 없으면 에러 메시지를 반환한다', () => {
    const result = extractContent('장절 없는 텍스트');
    expect(result.index).toBe('본문을 찾을 수 없습니다.');
    expect(result.content).toBe('');
  });

  it('"본문:" 접두사가 있어도 정상 파싱한다', () => {
    const input = '본문: 갈라디아서 5:22 22 오직 성령의 열매는';
    const result = extractContent(input);
    expect(result.index).toBe('갈라디아서 5:22');
    expect(result.content).toContain('22 오직 성령의 열매는');
  });

  // iOS 신규 포맷: 참조 쉼표 병합, 본문 이어붙임
  it('복수 참조가 쉼표로 합쳐진 신규 포맷을 정상 파싱한다', () => {
    const input =
      '본문 : 사무엘상 21:10-15, 사무엘상 22:1-2 10 그 날에 다윗이 11 아기스의 신하들이 1 그러므로 다윗이 2 환난 당한 모든 자와';
    const result = extractContent(input);
    expect(result.index).toBe('사무엘상 21:10-15, 사무엘상 22:1-2');
    expect(result.content).toContain('10 그 날에 다윗이');
    expect(result.content).toContain('11 아기스의 신하들이');
    expect(result.content).toContain('1 그러므로 다윗이');
    expect(result.content).toContain('2 환난 당한 모든 자와');
  });

  // 책 이름에 숫자가 포함된 경우 (예: 요한1서) 정상 파싱되는지 확인
  it('책 이름에 숫자가 포함되어도 정상 분리한다', () => {
    const input =
      '요한1서 4:1 사랑하는 자들아 영을 다 믿지 말고 오직 영들이 하나님께 속하였나 분별하라 많은 거짓 선지자가 세상에 나왔음이라';
    const result = extractContent(input);
    expect(result.index).toBe('요한1서 4:1');
    expect(result.content).toBe(
      '사랑하는 자들아 영을 다 믿지 말고 오직 영들이 하나님께 속하였나 분별하라 많은 거짓 선지자가 세상에 나왔음이라',
    );
  });

  // iOS 구 포맷: 각 참조가 "본문 : "\n\n"본문 : " 패턴으로 저장됨
  it('iOS 구 포맷 (복수 "본문 :" 섹션)을 각 섹션별로 파싱해 합산한다', () => {
    const oldFormat =
      '본문 : 사무엘상 21:10-15 10 그 날에 다윗이 11 아기스의 신하들이\n\n본문 : 사무엘상 22:1-2 1 그러므로 다윗이 2 환난 당한 모든 자와';
    const result = extractContent(oldFormat);
    // 두 참조가 쉼표로 합쳐져야 한다
    expect(result.index).toContain('사무엘상 21:10-15');
    expect(result.index).toContain('사무엘상 22:1-2');
    // 두 섹션의 본문이 모두 포함되어야 한다
    expect(result.content).toContain('10 그 날에 다윗이');
    expect(result.content).toContain('11 아기스의 신하들이');
    expect(result.content).toContain('1 그러므로 다윗이');
    expect(result.content).toContain('2 환난 당한 모든 자와');
    // 두 번째 "본문 :" 텍스트가 본문에 포함되지 않아야 한다
    expect(result.content).not.toContain('본문');
  });
});
