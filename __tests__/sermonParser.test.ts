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
});
