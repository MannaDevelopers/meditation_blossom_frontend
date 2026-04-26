---
name: work-issue
description: |
  Use when starting work on a GitHub issue end-to-end in this repo:
  fetch issue → worktree → plan → implement → PR → auto-merge.
  Triggers: /work-issue <num>, "이슈 N 작업해줘", "이슈 N부터 PR까지".
---

# work-issue: 이슈 → PR 머지까지 자동화

## 전제

- main은 보호되어 있어 직접 push가 막혀 있다. 모든 변경은 PR로 진입.
- 커밋 컨벤션: `[ISSUE-<n>] <type>: <설명>`. PR 제목: `[ISSUE-<n>] <설명>`.
- 본 스킬은 한 번에 1 이슈만 처리한다.

## 입력

- `$ISSUE_NUMBER`: GitHub 이슈 번호 (정수). 없으면 슬래시 커맨드 측에서 사용자 선택.

## 흐름

순서대로 실행한다. 각 단계는 `steps/<번호>-<이름>.md`에 상세 지시가 있다.
단계 실패 시 `references/failure-recovery.md` 정책을 따른다 — 자동으로 worktree/브랜치를 지우지 않는다.

1. `steps/01-fetch-issue.md` — 이슈 메타 로드
2. `steps/02-create-worktree.md` — worktree + 브랜치 생성
3. `steps/03-setup.md` — yarn/pod 설치
4. `steps/04-plan.md` — `superpowers:writing-plans` 위임 → **게이트 1**
5. `steps/05-implement.md` — `superpowers:executing-plans` 위임
6. `steps/06-test-slot.md` — 테스트 슬롯 (현재 no-op)
7. `steps/07-commit-push.md` — 커밋 + push
8. `steps/08-create-pr.md` — PR 생성 → **게이트 2**
9. `steps/09-auto-merge.md` — `gh pr merge --squash --auto`
10. `steps/10-cleanup.md` — worktree/브랜치 정리

## 게이트

- **게이트 1 (계획 직후)**: plan 경로와 핵심 task 목록을 사용자에게 제시. "OK / 수정 / 중단" 응답 대기.
- **게이트 2 (PR 생성 직후, 머지 직전)**: PR URL과 변경 요약(`git diff --stat main..HEAD`)을 제시. "머지 / 보류 / 중단" 응답 대기.

게이트 외 단계는 끊지 않고 실행한다.

## 상태 변수

스킬 실행 동안 보존:
- `$ISSUE_NUMBER` — 정수
- `$ISSUE_TITLE` — gh로 받은 원제목
- `$ISSUE_BODY` — gh로 받은 본문
- `$WORKTREE_PATH` — 절대경로
- `$BRANCH_NAME` — `feature/issue-<n>`
- `$PLAN_PATH` — 4단계 산출물
- `$PR_NUMBER` — 8단계 산출물
- `$PR_URL` — 8단계 산출물
