# work-issue 워크플로우 설계

**작성일**: 2026-04-26
**상태**: 초안 → 사용자 검토 대기
**대상**: 묵상만개 프론트엔드 리포 (`MannaDevelopers/meditation_blossom_frontend`)

## 배경

- `main` 브랜치는 보호되어 있고 직접 push가 막혀 있음. 모든 변경은 PR을 통해서만 진입.
- 커밋/PR 컨벤션이 정해져 있음: 커밋 `[ISSUE-<n>] <type>: <설명>`, PR `[ISSUE-<n>] <설명>`.
- 현재 GitHub 이슈 1건을 받아 PR 머지까지 이어주는 자동화가 없어, 같은 셋업/네이밍/PR 본문 패턴을 매번 수동 반복.

## 목표

`/work-issue <issue-number>` 한 번으로 다음을 자동화한다:
이슈 가져오기 → worktree 분기 → 계획 → 구현 → (테스트 슬롯) → 커밋/푸시 → PR 생성 → auto-merge 활성화 → cleanup.

사용자 게이트는 두 곳: **계획 직후**, **PR 머지 직전**. 그 사이의 단계는 끊지 않는다.

## 비목표

- 다중 이슈 동시 처리. 한 번에 1 이슈.
- 이슈 자동 분류/우선순위 결정.
- 다른 리포지터리에서의 재사용. 본 스킬은 이 리포 전용.
- 테스트 명령 정의 — 슬롯만 두고 실제 명령은 후속 작업으로 미룬다.

## 아키텍처

### 진입점

- 슬래시 커맨드: `meditation_blossom_frontend/.claude/commands/work-issue.md`
  - 형태: 얇은 마크다운 파일. 인자(`$ARGUMENTS`)로 이슈 번호를 받아 스킬 호출.
  - 인자가 비어있으면 `gh issue list --state open`을 띄우고 사용자에게 번호를 받음.
- 스킬: `meditation_blossom_frontend/.claude/skills/work-issue/SKILL.md`
  - 실제 흐름·게이트 제어. 단계별 세부 지시는 `steps/`에 분리.

### 단계 구성

```
1. 이슈 가져오기
2. worktree 분기 (.worktrees/issue-<n>, 브랜치 feature/issue-<n>)
3. 셋업 (yarn install + macOS면 pod install)
4. 계획 (superpowers:writing-plans 위임)
   ── 게이트 1: 사용자 OK 대기
5. 구현 (superpowers:executing-plans 위임, cwd=worktree)
6. 테스트 슬롯 (현재 no-op)
7. 커밋 + 푸시
8. PR 생성
   ── 게이트 2: 사용자 OK 대기
9. auto-merge 활성화 (gh pr merge --squash --auto)
10. cleanup (worktree 제거, 로컬 브랜치 삭제)
```

### 단계별 책임

| # | 단계 | 호출 | 산출 |
|---|------|------|------|
| 1 | 이슈 가져오기 | `gh issue view <num> --json title,body,number,labels` | 이슈 객체 |
| 2 | worktree 분기 | `git worktree add .worktrees/issue-<n> -b feature/issue-<n>` | 격리 디렉터리 |
| 3 | 셋업 | `yarn install`; `uname -s = Darwin`이면 `cd ios && pod install` | 빌드 가능 상태 |
| 4 | 계획 | `superpowers:writing-plans` (이슈 본문을 spec 입력으로) | `docs/superpowers/plans/<date>-issue-<n>.md` |
| G1 | 게이트 1 | plan 경로 + 요약 제시, 사용자 응답 대기 | — |
| 5 | 구현 | `superpowers:executing-plans` (cwd=worktree) | 코드 변경 |
| 6 | 테스트 슬롯 | `runTestSlot()` (현재 즉시 성공) | — |
| 7 | 커밋·푸시 | `git commit -m "[ISSUE-<n>] <type>: <요약>"`; `git push -u origin feature/issue-<n>` | 원격 브랜치 |
| 8 | PR 생성 | `gh pr create --title "[ISSUE-<n>] <요약>" --body <템플>` | PR URL |
| G2 | 게이트 2 | PR URL + diff 요약 제시, 사용자 응답 대기 | — |
| 9 | auto-merge | `gh pr merge <num> --squash --auto` | 머지 예약 |
| 10 | cleanup | `git worktree remove`; `git branch -d feature/issue-<n>` | 정리 |

### 데이터 흐름

이슈 객체에서 산출물 자동 생성:

| 산출 | 규칙 |
|------|------|
| 브랜치명 | `feature/issue-<num>` |
| 커밋 메시지 | `[ISSUE-<num>] <type>: <요약>` — `<type>`은 staged diff를 보고 LLM이 결정(feat/fix/docs/refactor 중 하나), `<요약>`은 plan 파일의 첫 헤딩 또는 staged diff에서 한 문장으로 압축 |
| PR 제목 | `[ISSUE-<num>] <제목 일부>` — `gh issue view`로 받은 title에서 `[FE]`/`[Design]` 등 대괄호 prefix 토큰 제거 후 사용 |
| PR body | 고정 템플릿. `## 요약` 본문은 plan 파일의 "## 개요" 또는 첫 단락을 그대로 복사. `## 변경점`은 `git log feature/issue-<n> --not main --pretty=format:"- %s"` 출력. `## 테스트`는 슬롯 비활성 동안 `_(테스트 슬롯 비활성)_`. |

이슈의 `title` + `body`를 그대로 `superpowers:writing-plans`의 입력 spec으로 전달한다. 추가 가공은 하지 않는다.

`executing-plans`가 중간에 여러 커밋을 만들면 그대로 유지하되, 메시지 prefix `[ISSUE-<n>]`이 누락된 커밋은 후처리로 prefix를 추가한다.

### 테스트 슬롯

- 단계 6은 함수 본문이 비어 있어 즉시 성공한다.
- 슬롯 위치는 커밋(7) **직전**. 나중에 명령이 채워지면 실패 시 커밋이 막힌다.
- 채울 후보 (`steps/06-test-slot.md` 주석으로 명시): `yarn lint`, `yarn tsc --noEmit`, `yarn test`.
- 토글 플래그는 두지 않는다(YAGNI). 명령을 쓰면 켜지고, 비우면 꺼진다.

### 실패 처리

- 어떤 단계든 실패하면 즉시 중단하고 사용자에게:
  - 단계 이름
  - 실행한 명령과 출력
  - 다음 가능한 액션: 재시도 / 수정 후 재개 / 중단 후 cleanup
- 중간 실패 시 worktree와 브랜치는 **자동 삭제하지 않는다**. 사용자가 명시적으로 cleanup을 지시할 때만 제거. 이유: 작업 손실 방지.

## 파일 구성

```
meditation_blossom_frontend/
├── .claude/
│   ├── commands/
│   │   └── work-issue.md
│   └── skills/
│       └── work-issue/
│           ├── SKILL.md
│           ├── steps/
│           │   ├── 01-fetch-issue.md
│           │   ├── 02-create-worktree.md
│           │   ├── 03-setup.md
│           │   ├── 04-plan.md
│           │   ├── 05-implement.md
│           │   ├── 06-test-slot.md
│           │   ├── 07-commit-push.md
│           │   ├── 08-create-pr.md
│           │   ├── 09-auto-merge.md
│           │   └── 10-cleanup.md
│           └── references/
│               ├── pr-body-template.md
│               └── failure-recovery.md
├── .gitignore               # `.worktrees/` 추가 (스킬 첫 실행 시 자동)
└── docs/superpowers/
    ├── specs/               # 본 문서 위치
    └── plans/               # 4단계 산출물 위치
```

### 위치 선택 근거

- **프로젝트 로컬**: `.worktrees/` 경로, `yarn`/`pod install`, `[ISSUE-N]` prefix가 전부 이 리포 고유. 글로벌로 두면 다른 프로젝트에서 잘못 발동.
- **steps/ 분리**: SKILL.md 한 파일에 모든 단계 본문을 담으면 컨텍스트 비용이 크다. 단계별 분리 시 메인은 흐름과 게이트만, 각 단계는 필요할 때만 로드.

## 컨벤션 / 환경

- **PR 정책**: main 직접 push 불가. spec 문서 자체도 PR로 진입.
- **머지 방식**: squash (최근 커밋이 모두 squash 패턴 — `(#83)`, `(#80)` 등).
- **셋업**: 항상 자동 실행. iOS Pods는 macOS에서만.
- **`.gitignore`**: 스킬 첫 실행 시 `.worktrees/`가 없으면 자동 추가.

## 오픈 이슈 / 후속 작업

- 테스트 슬롯에 어떤 명령을 채울지(범위·시간) 미정. 슬롯 형태만 잡고 후속 spec에서 결정.
- 이슈 라벨 기반 자동 분기(예: `hotfix` 라벨이면 PR 제목 prefix를 `[HOTFIX]`로) — 본 스펙 범위 외.
- 머지 후 이슈 자동 close — `Closes #<n>`을 PR body에 넣어 GitHub가 처리하도록 함. 별도 로직 없음.
