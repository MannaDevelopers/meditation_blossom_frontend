// Android VerseParser와 동일한 정규식 사용
// 책 이름 토큰은 \S+로 매칭 (공백으로만 구분) — "요한1서"처럼 이름에 숫자가
// 포함된 경우 [^\d\s]+(숫자 제외)로는 "1" 앞에서 끊겨 "서 4:1"처럼 잘못
// 파싱되는 문제가 있어 수정함
const bookNameRegex = /(본문\s*[:：]?\s*)?(\S+ ?\d+:\d+(?:-\d+)?(?:,\s*\S+ ?\d+:\d+(?:-\d+)?)*)/;
const verseNumberRegex = /\d+/g;

/** 단일 "참조 구절" 블록을 파싱 */
function parseSingleSection(text: string): { index: string; content: string } {
  const match = text.match(bookNameRegex);
  if (!match) {
    return { index: '본문을 찾을 수 없습니다.', content: '' };
  }

  const bookName = match[2].trim();
  const matchIndex = text.indexOf(match[0]);
  const matchLength = match[0].length;
  const contentAfterBookName = text.slice(matchIndex + matchLength).trim();

  if (!contentAfterBookName) {
    return { index: bookName, content: '본문 내용을 찾을 수 없습니다.' };
  }

  const verseMatches = Array.from(contentAfterBookName.matchAll(verseNumberRegex));

  if (verseMatches.length === 0) {
    return { index: bookName, content: contentAfterBookName };
  }

  const verseTexts: string[] = [];

  for (let i = 0; i < verseMatches.length; i++) {
    const currentMatch = verseMatches[i];
    const verseNumber = currentMatch[0];
    const verseStartIndex = currentMatch.index!;
    const verseEndIndex = verseStartIndex + verseNumber.length;

    let verseText: string;

    if (i < verseMatches.length - 1) {
      const nextVerseStartIndex = verseMatches[i + 1].index!;
      verseText = contentAfterBookName.slice(verseEndIndex, nextVerseStartIndex).trim();
    } else {
      verseText = contentAfterBookName.slice(verseEndIndex).trim();
    }

    verseTexts.push(`${verseNumber} ${verseText}`);
  }

  return {
    index: bookName,
    content: verseTexts.join('\n\n'),
  };
}

/**
 * 말씀 본문 텍스트를 { index: 참조, content: 구절 } 형태로 파싱.
 *
 * 정상 포맷 (Android / iOS 신규):
 *   "본문 : 참조1, 참조2 31 구절1 32 구절2 25 구절3..."
 *
 * 구 포맷 (iOS 이전 버전 캐시):
 *   "본문 : 참조1 31 구절1\n\n본문 : 참조2 1 구절2..."
 *   → \n\n본문 : 을 구분자로 각 섹션을 분리해 처리 후 합산
 */
export const extractContent = (text: string): { index: string; content: string } => {
  // iOS 구 포맷 감지: "\n\n본문 :" 구분자가 2개 이상 섹션을 만드는 경우
  const oldFormatSeparator = /\n\n본문\s*[:：]/;
  if (oldFormatSeparator.test(text)) {
    // "\n\n본문 :" 직전에서 분리 → 각 섹션은 독립적으로 파싱
    const sections = text.split(/\n\n(?=본문\s*[:：])/);
    const allRefs: string[] = [];
    const allContents: string[] = [];

    for (const section of sections) {
      const parsed = parseSingleSection(section);
      if (parsed.index && parsed.index !== '본문을 찾을 수 없습니다.') {
        allRefs.push(parsed.index);
      }
      if (parsed.content) {
        allContents.push(parsed.content);
      }
    }

    if (allRefs.length > 0) {
      return {
        index: allRefs.join(', '),
        content: allContents.join('\n\n'),
      };
    }
  }

  // 정상 포맷: 단일 파싱
  return parseSingleSection(text);
};
