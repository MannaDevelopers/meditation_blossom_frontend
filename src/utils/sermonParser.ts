// Android VerseParser와 동일한 정규식 사용
const bookNameRegex = /(본문\s*[:：]?\s*)?([^\d\s]+ ?\d+:\d+(?:-\d+)?(?:,\s*[^\d\s]+ ?\d+:\d+(?:-\d+)?)*)/;
const verseNumberRegex = /\d+/g;

export const extractContent = (text: string): { index: string; content: string } => {
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
};
