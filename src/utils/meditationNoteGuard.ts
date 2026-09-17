/**
 * 묵상 메모 자동 삭제 판단(테스터 피드백 [묵상나눔 자동 삭제]).
 *
 * primary(week 등 "같은 말씀 묶음"을 나타내는 값)가 같으면 무조건 유지한다 — 예배시간
 * 설정을 바꿔 같은 주의 다른 예배로 전환하는 것도 여기 해당하며, 이 경우 절대 지우면 안
 * 된다(설정 변경만으로 묵상이 사라지는 건 사용자 입장에서 사고다).
 *
 * primary가 다르면(주가 넘어감) identity별로 정해둔 onMismatch를 따른다:
 * - QT는 새 날짜가 오면 물어볼 것 없이 바로 지운다(기획 확정).
 * - 말씀(주일 특정 예배시간 / 전체 옵션 모두)은 확신할 수 없으니 자동 삭제 대신 배너로
 *   사용자에게 확인한다.
 */
export interface NoteIdentity {
  primary: string;
  onMismatch: 'auto_clear' | 'confirm_clear';
}

export type NoteGuardAction = 'keep' | 'auto_clear' | 'confirm_clear';

export function decideNoteGuardAction(
  stored: NoteIdentity | null,
  current: NoteIdentity,
): NoteGuardAction {
  if (!stored) return 'keep';
  if (stored.primary === current.primary) return 'keep';
  return current.onMismatch;
}
