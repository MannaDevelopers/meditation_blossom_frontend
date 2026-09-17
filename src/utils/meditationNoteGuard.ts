/**
 * 묵상 메모 자동 삭제 판단(테스터 피드백 [묵상나눔 자동 삭제]).
 *
 * - primary가 다르면 "확실히 다른 말씀"으로 보고 무조건 삭제한다.
 * - primary가 같은데 secondary까지 있고 그 값이 다르면 "같은 주 안에서 내용이 바뀐" 애매한
 *   경우(전체 옵션)이므로 자동 삭제하지 않고 배너로 사용자에게 확인한다.
 * - secondary가 없는 호출자(주일 말씀 특정 예배시간, QT)는 애초에 애매한 경우가 없어
 *   confirm_clear로 갈 일이 없다.
 */
export interface NoteIdentity {
  primary: string;
  secondary?: string;
}

export type NoteGuardAction = 'keep' | 'auto_clear' | 'confirm_clear';

export function decideNoteGuardAction(
  stored: NoteIdentity | null,
  current: NoteIdentity,
): NoteGuardAction {
  if (!stored) return 'keep';
  if (stored.primary !== current.primary) return 'auto_clear';
  if (current.secondary !== undefined && stored.secondary !== current.secondary) {
    return 'confirm_clear';
  }
  return 'keep';
}
