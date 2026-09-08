/**
 * 묵상 메모 복사 포맷([#174] 기획 확정):
 *
 *   {말씀 제목}
 *   {묵상 내용}
 *
 * 제목은 반드시 `sermon.title` / `qt.title` 원문을 넘긴다. 화면에 그려지는 제목은
 * processTitleText(textFormatting.ts)가 표시용 줄바꿈을 끼워넣은 값이라 그대로 복사하면
 * 원문에 없던 개행이 딸려간다.
 *
 * 제목은 "복사 시점의 최신 말씀"을 쓰고 묵상 내용은 유지한다 —
 * 8/3에 쓴 묵상을 8/4에 복사하면 8/4 제목과 짝지어진다(기획 확정, #174 코멘트).
 */
export function formatMeditationNoteForCopy(
  title: string | undefined | null,
  note: string,
): string {
  const trimmedTitle = (title ?? '').trim();
  const trimmedNote = note.trim();
  // 한쪽이 비면 빈 줄이 남지 않도록 있는 것만 이어붙인다.
  return [trimmedTitle, trimmedNote].filter(Boolean).join('\n');
}

/** 복사할 내용이 있는지. 묵상 내용이 비어 있으면 제목만 복사되는 것을 막는다. */
export function hasCopyableNote(note: string): boolean {
  return note.trim().length > 0;
}
