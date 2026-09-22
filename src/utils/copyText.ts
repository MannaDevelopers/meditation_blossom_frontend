import { ScripturePassage } from '../services/scriptureService';

/**
 * 칩 옆 복사 버튼이 담는 내용([#166]).
 * 붙여넣었을 때 어느 장절인지 알 수 있어야 하므로 라벨을 함께 넣는다.
 */
export function buildPassageCopyText(passage: ScripturePassage): string {
  return `${passage.label}\n${passage.content}`;
}

interface FullCopyParams {
  /** processTitleText를 거치지 않은 원문 제목. 표시용 줄바꿈이 딸려가면 안 된다. */
  title: string | undefined;
  passages: ScripturePassage[];
  /** 매일 만나에만 있다. 주일 말씀은 넘기지 않는다. */
  questions?: string[];
}

// 콘텐츠 작성자가 하위 질문에 직접 붙이는 원문자 번호(❶ ❷ … / ① ② …).
// 이미 자체 번호가 있는 줄은 "- "를 덧붙이면 "- ❶"처럼 중복돼 보인다.
const NUMBERED_QUESTION_PATTERN = /^[①-⑳❶-❿]/;

/**
 * 묵상 질문 섹션 복사 버튼 · 전체 복사 버튼이 공유하는 포맷([#300]).
 * 빈 질문은 제외한다. 원문자 번호가 있는 줄은 "- "를 붙이지 않는다.
 */
export function buildQuestionsCopyText(questions: string[]): string {
  const asked = questions.map(q => q.trim()).filter(Boolean);
  return [
    '묵상 질문',
    ...asked.map(q => (NUMBERED_QUESTION_PATTERN.test(q) ? q : `- ${q}`)),
  ].join('\n');
}

/**
 * 화면 전체 복사([#166] 확정 대상: 제목 · 장절 참조 · 본문 전체 · 묵상질문).
 * 빈 항목은 통째로 빠져 빈 줄이 남지 않는다.
 */
export function buildFullCopyText({ title, passages, questions }: FullCopyParams): string {
  const blocks: string[] = [];
  const trimmedTitle = (title ?? '').trim();
  if (trimmedTitle) blocks.push(trimmedTitle);
  passages.forEach(p => blocks.push(buildPassageCopyText(p)));
  const asked = (questions ?? []).map(q => q.trim()).filter(Boolean);
  if (asked.length > 0) {
    blocks.push(buildQuestionsCopyText(asked));
  }
  return blocks.join('\n\n');
}
