import { decideScriptureMode, formatReferenceLabel } from '../src/utils/scriptureLayout';

// 장 길이를 모르는 상태 = "장 전체" 판정 불가. 개수 규칙만 남는다.
const noChapterLengths = () => undefined;

describe('decideScriptureMode', () => {
  it('참조가 4개 이상이면 페이지 모드다', () => {
    const refs = [
      { book: '시편', chapter: 51, verse_start: 1, verse_end: 5 },
      { book: '시편', chapter: 52, verse_start: 1, verse_end: 5 },
      { book: '시편', chapter: 53, verse_start: 1, verse_end: 5 },
      { book: '시편', chapter: 54, verse_start: 1, verse_end: 5 },
    ];
    expect(decideScriptureMode(refs, noChapterLengths)).toBe('paged');
  });

  // 기획 보완 조건: 개수만으로 판단하면 3개 이하라도 그중 하나가 "장 전체"일 때 너무 길어진다.
  it('참조가 1개여도 그 참조가 장 전체면 페이지 모드다', () => {
    // 열왕기하 24장은 20절까지 → 24:1-20 은 장 전체
    const lastVerseOf = () => 20;
    const refs = [{ book: '열왕기하', chapter: 24, verse_start: 1, verse_end: 20 }];
    expect(decideScriptureMode(refs, lastVerseOf)).toBe('paged');
  });
});

describe('formatReferenceLabel', () => {
  it('단일 절이면 범위 표기를 붙이지 않는다', () => {
    expect(formatReferenceLabel({ book: '열왕기하', chapter: 22, verse_start: 2, verse_end: 2 }))
      .toBe('열왕기하 22:2');
  });

  it('여러 절이면 시작-끝 범위를 붙인다', () => {
    expect(formatReferenceLabel({ book: '열왕기하', chapter: 23, verse_start: 21, verse_end: 25 }))
      .toBe('열왕기하 23:21-25');
  });
});
