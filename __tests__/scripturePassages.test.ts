import { resolvePassages } from '../src/services/scriptureService';

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const noChapterLengths = () => undefined;

const KINGS_22_2 = { book: '열왕기하', chapter: 22, verse_start: 2, verse_end: 2 };
const KINGS_23_21_25 = { book: '열왕기하', chapter: 23, verse_start: 21, verse_end: 25 };

describe('resolvePassages', () => {
  // 기존 브릿지는 여러 참조를 한 덩어리로 합쳐 돌려준다. 참조당 1개짜리 배열로 나눠 부르면
  // 참조별로 분리된 결과를 얻는다 — 이게 네이티브를 안 건드리고 칩을 만드는 근거다([#173]).
  it('참조마다 브릿지를 따로 호출해 참조별 본문을 만든다', async () => {
    const calls: string[] = [];
    const resolve = async (refsJson: string) => {
      calls.push(refsJson);
      const [ref] = JSON.parse(refsJson);
      return ref.chapter === 22
        ? '본문 : 열왕기하 22:2 2 요시야가 여호와 보시기에 정직히 행하여'
        : '본문 : 열왕기하 23:21-25 21 왕이 뭇 백성에게 명령하여';
    };

    const passages = await resolvePassages(
      [KINGS_22_2, KINGS_23_21_25],
      resolve,
      noChapterLengths,
    );

    // 합쳐서 한 번이 아니라, 참조 개수만큼 각각 호출해야 한다
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[0])).toEqual([KINGS_22_2]);
    expect(JSON.parse(calls[1])).toEqual([KINGS_23_21_25]);

    expect(passages).toHaveLength(2);
    expect(passages[0].label).toBe('열왕기하 22:2');
    expect(passages[0].content).toContain('요시야가 여호와 보시기에');
    expect(passages[1].label).toBe('열왕기하 23:21-25');
    expect(passages[1].content).toContain('왕이 뭇 백성에게');
  });
});
