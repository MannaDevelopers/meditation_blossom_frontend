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
    blocks.push(['묵상 질문', ...asked.map(q => `- ${q}`)].join('\n'));
  }
  return blocks.join('\n\n');
}
