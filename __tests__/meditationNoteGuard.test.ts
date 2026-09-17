import { decideNoteGuardAction } from '../src/utils/meditationNoteGuard';

describe('decideNoteGuardAction', () => {
  it('기준선이 없으면(최초) 유지 — 지울 대상이 없다', () => {
    expect(
      decideNoteGuardAction(null, { primary: '2026-W37', onMismatch: 'confirm_clear' }),
    ).toBe('keep');
  });

  it('primary가 같으면 유지', () => {
    const identity: { primary: string; onMismatch: 'confirm_clear' } = {
      primary: '2026-W37',
      onMismatch: 'confirm_clear',
    };
    expect(decideNoteGuardAction(identity, identity)).toBe('keep');
  });

  // 설정 화면에서 예배시간만 바꿔도 identity 계산 단계에서 primary(week)는 그대로라 유지된다.
  it('primary(week)가 같으면 다른 예배로 전환해도(설정 변경) 유지된다', () => {
    const before = { primary: '2026-W37', onMismatch: 'confirm_clear' as const };
    const after = { primary: '2026-W37', onMismatch: 'confirm_clear' as const };
    expect(decideNoteGuardAction(before, after)).toBe('keep');
  });

  // 말씀 week이 실제로 넘어간 경우 — 확신할 수 없으니 자동 삭제 대신 배너로 확인한다.
  it('말씀(sermon)은 primary가 다르면 확인(배너)', () => {
    expect(
      decideNoteGuardAction(
        { primary: '2026-W36', onMismatch: 'confirm_clear' },
        { primary: '2026-W37', onMismatch: 'confirm_clear' },
      ),
    ).toBe('confirm_clear');
  });

  // QT는 새 날짜가 오면 물어볼 것 없이 바로 지운다(기획 확정).
  it('QT는 primary가 다르면 무조건 자동 삭제', () => {
    expect(
      decideNoteGuardAction(
        { primary: '2026-09-13', onMismatch: 'auto_clear' },
        { primary: '2026-09-14', onMismatch: 'auto_clear' },
      ),
    ).toBe('auto_clear');
  });
});
