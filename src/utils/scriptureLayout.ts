/** Firestore `bible_references` 원소. verse_end는 서버가 생략할 수 있다. */
export interface BibleRef {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
}

/** inline = 칩 + 본문 이어붙이기, paged = 선택 탭 + 참조당 한 페이지 */
export type ScriptureMode = 'inline' | 'paged';

/** 해당 장의 마지막 절 번호. 모르면 undefined. */
export type ChapterLastVerseLookup = (book: string, chapter: number) => number | undefined;

/**
 * 칩·선택 탭에 쓰는 참조 라벨. 네이티브 리졸버(BibleReferenceResolver.kt:57-62,
 * WidgetUpdateModule.swift:343)가 만드는 표기와 같은 규칙이라 화면과 위젯의 장절 표기가 일치한다.
 */
export function formatReferenceLabel(ref: BibleRef): string {
  const end = ref.verse_end ?? ref.verse_start;
  const range = end === ref.verse_start ? `${ref.verse_start}` : `${ref.verse_start}-${end}`;
  return `${ref.book} ${ref.chapter}:${range}`;
}

/**
 * verse_start가 1이고 verse_end가 그 장의 마지막 절과 같으면 "장 전체"로 본다([#173]).
 * 장 길이를 모르면(테이블에 없는 책 이름 등) 판정하지 않고 false로 떨어져
 * inline 쪽으로 안전하게 기운다.
 */
export function isWholeChapter(
  ref: BibleRef,
  lastVerseOf: ChapterLastVerseLookup,
): boolean {
  const lastVerse = lastVerseOf(ref.book, ref.chapter);
  if (lastVerse === undefined) return false;
  return ref.verse_start === 1 && (ref.verse_end ?? ref.verse_start) === lastVerse;
}

export function decideScriptureMode(
  refs: BibleRef[],
  lastVerseOf: ChapterLastVerseLookup,
): ScriptureMode {
  if (refs.length >= 4) return 'paged';
  return refs.some(ref => isWholeChapter(ref, lastVerseOf)) ? 'paged' : 'inline';
}
