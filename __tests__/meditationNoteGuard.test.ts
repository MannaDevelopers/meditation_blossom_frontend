import { decideNoteGuardAction } from '../src/utils/meditationNoteGuard';

describe('decideNoteGuardAction', () => {
  it('기준선이 없으면(최초) 유지 — 지울 대상이 없다', () => {
    expect(decideNoteGuardAction(null, { primary: '2026-W37_SUN_0950' })).toBe('keep');
  });

  it('primary가 같으면 유지', () => {
    const identity = { primary: '2026-W37_SUN_0950' };
    expect(decideNoteGuardAction(identity, identity)).toBe('keep');
  });

  // 다음 주 새 말씀(week 변경) — video_url만 바뀐 게 아니라 확실히 다른 말씀이므로 바로 지운다.
  it('primary가 다르면 무조건 자동 삭제', () => {
    expect(
      decideNoteGuardAction({ primary: '2026-W36_SUN_0950' }, { primary: '2026-W37_SUN_0950' }),
    ).toBe('auto_clear');
  });

  // '전체' 옵션: 같은 ISO week 안에서 문서(secondary)가 바뀐 애매한 경우는 자동 삭제 대신 확인.
  it('primary가 같고 secondary만 다르면 확인(배너)', () => {
    expect(
      decideNoteGuardAction(
        { primary: '2026-W37', secondary: 'doc-a' },
        { primary: '2026-W37', secondary: 'doc-b' },
      ),
    ).toBe('confirm_clear');
  });

  it('secondary가 없는 호출자(주일 특정 예배/QT)는 애초에 confirm으로 가지 않는다', () => {
    expect(
      decideNoteGuardAction({ primary: '2026-W37_SUN_0950' }, { primary: '2026-W37_SUN_0950' }),
    ).toBe('keep');
  });

  // video_url만 채워지는 갱신은 identity 계산 단계에서 애초에 primary/secondary가 안 바뀌므로 유지된다.
  it('primary와 secondary가 모두 같으면(video_url만 갱신) 유지', () => {
    expect(
      decideNoteGuardAction(
        { primary: '2026-W37', secondary: 'doc-a' },
        { primary: '2026-W37', secondary: 'doc-a' },
      ),
    ).toBe('keep');
  });
});
