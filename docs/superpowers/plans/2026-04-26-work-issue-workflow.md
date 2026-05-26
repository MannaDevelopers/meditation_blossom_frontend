# work-issue 워크플로우 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec(`docs/superpowers/specs/2026-04-26-work-issue-workflow-design.md`)에 정의된 `/work-issue` 워크플로우를 마크다운 스킬 + 슬래시 커맨드로 구현한다.

**Architecture:** 얇은 슬래시 커맨드 진입점 → 메인 SKILL.md(흐름 제어 + 게이트) → `steps/` 디렉터리의 단계별 마크다운 파일들 → `references/`의 템플릿/실패 복구 문서. superpowers의 `writing-plans`/`executing-plans`는 단계 4·5에서 위임 호출.

**Tech Stack:** Claude Code 마크다운 스킬, gh CLI, git worktree, yarn, CocoaPods.

**테스트 정책:** 본 plan은 마크다운 정의 파일을 작성하는 작업이라 단위 테스트 대상이 아니다. 검증은 마지막 task에서 실제 이슈로 dogfood. spec에 명시된 "테스트 슬롯"은 단계 6 파일에서 no-op 형태로 자리만 잡는다.

**커밋·머지 정책:** main 보호 룰 때문에 본 plan의 산출물은 별도 브랜치(예: `feature/work-issue-skill`)에서 작업한 뒤 PR로 머지한다. 각 task 종료 시 의미 단위로 커밋만 하고, push/PR은 plan 완료 후 사용자가 운영.

---

## File Structure

| 경로 | 책임 |
|------|------|
| `.claude/commands/work-issue.md` | 슬래시 커맨드 진입점. 인자(이슈 번호) 받아 스킬 호출 |
| `.claude/skills/work-issue/SKILL.md` | 메인 흐름 제어 + 게이트 정의 |
| `.claude/skills/work-issue/steps/01-fetch-issue.md` | gh로 이슈 메타 로드 |
| `.claude/skills/work-issue/steps/02-create-worktree.md` | `.worktrees/issue-<n>` + 브랜치 생성 |
| `.claude/skills/work-issue/steps/03-setup.md` | yarn / pod 설치 |
| `.claude/skills/work-issue/steps/04-plan.md` | superpowers:writing-plans 위임 + 게이트 1 |
| `.claude/skills/work-issue/steps/05-implement.md` | superpowers:executing-plans 위임 |
| `.claude/skills/work-issue/steps/06-test-slot.md` | no-op 슬롯 + 미래 명령 후보 주석 |
| `.claude/skills/work-issue/steps/07-commit-push.md` | 커밋 메시지 prefix 검사 + push |
| `.claude/skills/work-issue/steps/08-create-pr.md` | gh pr create + 게이트 2 |
| `.claude/skills/work-issue/steps/09-auto-merge.md` | gh pr merge --squash --auto |
| `.claude/skills/work-issue/steps/10-cleanup.md` | worktree/브랜치 정리 |
| `.claude/skills/work-issue/references/pr-body-template.md` | PR body 템플릿 |
| `.claude/skills/work-issue/references/failure-recovery.md` | 단계별 실패 시 액션 표 |

`.gitignore`에는 이미 `.worktrees/`가 등록되어 있어 별도 task 없음.

---

## Task 1: 슬래시 커맨드 진입점 작성

**Files:**
- Create: `.claude/commands/work-issue.md`

- [ ] **Step 1: 파일 작성**

전체 내용:
````markdown
---
description: GitHub 이슈 1건을 받아 worktree 분기 → 계획 → 구현 → PR → auto-merge까지 자동화
argument-hint: <issue-number>
---

work-issue 스킬을 호출해 이슈 작업을 시작한다.

인자 처리:
- `$ARGUMENTS`가 숫자면 그 이슈 번호를 사용한다.
- 비어 있으면 `gh issue list --state open --limit 20`을 실행해 사용자에게 보여주고 번호 선택을 받는다.

이후 `meditation_blossom_frontend/.claude/skills/work-issue/SKILL.md`의 흐름을 따른다.
````

- [ ] **Step 2: 커밋**

```bash
git add .claude/commands/work-issue.md
git commit -m "[ISSUE-WI] feat: work-issue 슬래시 커맨드 진입점 추가"
```

(브랜치명·이슈 번호는 운영 시 결정. 메시지의 `[ISSUE-WI]`는 임시 placeholder로, 실제 머지 PR의 이슈 번호로 치환한다.)

---

## Task 2: 메인 SKILL.md 작성

**Files:**
- Create: `.claude/skills/work-issue/SKILL.md`

- [ ] **Step 1: 파일 작성**

전체 내용:
````markdown
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
````

- [ ] **Step 2: 커밋**

```bash
git add .claude/skills/work-issue/SKILL.md
git commit -m "[ISSUE-WI] feat: work-issue 메인 스킬 정의"
```

---

## Task 3: 이슈·worktree·셋업 단계 파일

**Files:**
- Create: `.claude/skills/work-issue/steps/01-fetch-issue.md`
- Create: `.claude/skills/work-issue/steps/02-create-worktree.md`
- Create: `.claude/skills/work-issue/steps/03-setup.md`

- [ ] **Step 1: `01-fetch-issue.md` 작성**

````markdown
# 단계 1: 이슈 메타 로드

## 명령

```bash
gh issue view $ISSUE_NUMBER --json number,title,body,labels
```

## 처리

- 출력 JSON에서 `number`/`title`/`body`/`labels`를 추출해 상태 변수에 저장한다.
- `state`가 `closed`면 사용자에게 "이미 닫힌 이슈입니다. 계속할까요?" 확인.
- 인증 실패(401/403) 시 `gh auth status`를 안내하고 중단.

## 실패 시

`references/failure-recovery.md`의 "이슈 로드 실패" 항목 참조.
````

- [ ] **Step 2: `02-create-worktree.md` 작성**

````markdown
# 단계 2: worktree + 브랜치 생성

## 변수

- `$WORKTREE_PATH` = `<repo-root>/.worktrees/issue-$ISSUE_NUMBER`
- `$BRANCH_NAME` = `feature/issue-$ISSUE_NUMBER`

## 명령

```bash
# 같은 경로에 이미 존재하면 사용자에게 재사용/삭제 선택을 받는다
test -e "$WORKTREE_PATH" && echo "이미 존재함: $WORKTREE_PATH"

git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
```

이미 존재할 때 처리:
- "재사용": worktree 경로만 cwd로 사용. 기존 변경사항을 사용자에게 git status로 보여줌.
- "삭제 후 재생성": `git worktree remove "$WORKTREE_PATH" --force` 후 다시 add. 사용자가 명시적으로 동의했을 때만.

## 후처리

- 이후 모든 명령의 cwd를 `$WORKTREE_PATH`로 한다.

## 실패 시

`references/failure-recovery.md`의 "worktree 생성 실패" 항목.
````

- [ ] **Step 3: `03-setup.md` 작성**

````markdown
# 단계 3: 셋업 (yarn / pod)

## 명령

```bash
# cwd: $WORKTREE_PATH
yarn install

if [ "$(uname -s)" = "Darwin" ]; then
  (cd ios && pod install)
fi
```

## 시간 안내

- yarn install ~30초~수 분
- pod install ~1~3분 (네트워크 상태에 따라)

진행 메시지로 사용자에게 알린다. timeout은 600000ms 기본값을 사용.

## 실패 시

- yarn 실패: 출력 보여주고 재시도 / 중단 선택.
- pod 실패: macOS가 아닐 때(Linux CI 등)는 무시한다. 실제 실패면 출력 보여주고 사용자에게.

`references/failure-recovery.md` "셋업 실패" 항목.
````

- [ ] **Step 4: 커밋**

```bash
git add .claude/skills/work-issue/steps/01-fetch-issue.md \
        .claude/skills/work-issue/steps/02-create-worktree.md \
        .claude/skills/work-issue/steps/03-setup.md
git commit -m "[ISSUE-WI] feat: work-issue 단계 1-3 (이슈/worktree/셋업)"
```

---

## Task 4: 계획·구현·테스트 단계 파일

**Files:**
- Create: `.claude/skills/work-issue/steps/04-plan.md`
- Create: `.claude/skills/work-issue/steps/05-implement.md`
- Create: `.claude/skills/work-issue/steps/06-test-slot.md`

- [ ] **Step 1: `04-plan.md` 작성**

````markdown
# 단계 4: 계획 (writing-plans 위임) + 게이트 1

## 호출

`superpowers:writing-plans` 스킬을 호출한다. 입력 spec으로 다음을 그대로 전달:

```
# Issue #$ISSUE_NUMBER: $ISSUE_TITLE

$ISSUE_BODY
```

## 산출물 위치

`docs/superpowers/plans/<YYYY-MM-DD>-issue-$ISSUE_NUMBER.md`

`$PLAN_PATH`에 경로를 저장한다.

## 게이트 1

사용자에게 다음을 보여준 뒤 응답을 기다린다:

- `$PLAN_PATH` 경로
- plan 파일에서 `## Tasks` 섹션의 task 제목 목록
- "이 plan으로 진행할까요? (OK / 수정 / 중단)"

응답:
- "OK" → 단계 5로 진행
- "수정" → writing-plans 스킬에 사용자 코멘트를 전달해 재작성
- "중단" → worktree와 브랜치는 보존한 채 종료
````

- [ ] **Step 2: `05-implement.md` 작성**

````markdown
# 단계 5: 구현 (executing-plans 위임)

## 호출

`superpowers:executing-plans` 스킬을 호출한다. 인자:
- plan 파일: `$PLAN_PATH`
- 작업 디렉터리: `$WORKTREE_PATH`

## 완료 후

```bash
git status
git diff --stat
```

요약을 사용자에게 보여주고, 변경사항이 없으면 사용자에게 확인 후 다음 단계로.

## 실패 시

executing-plans가 자체 체크포인트로 멈췄다면, 그 상태를 사용자에게 보여준다. 작업물은 보존.
````

- [ ] **Step 3: `06-test-slot.md` 작성**

````markdown
# 단계 6: 테스트 슬롯

## 현재 동작

no-op. 즉시 성공으로 간주한다.

## 나중에 채울 명령 후보

이 슬롯은 단계 7(커밋·푸시) 직전이다. 명령이 채워지면 실패 시 커밋이 막힌다.

```bash
# yarn lint
# yarn tsc --noEmit
# yarn test --watchAll=false
```

명령을 추가할 때:
- 위 주석을 풀어 실제 명령으로 바꾸고
- 실패 시 출력을 사용자에게 보여주고 "재시도 / 수정 / 중단" 분기를 추가한다.

토글 플래그는 두지 않는다. 명령이 있으면 켜진 상태, 없으면 꺼진 상태다.
````

- [ ] **Step 4: 커밋**

```bash
git add .claude/skills/work-issue/steps/04-plan.md \
        .claude/skills/work-issue/steps/05-implement.md \
        .claude/skills/work-issue/steps/06-test-slot.md
git commit -m "[ISSUE-WI] feat: work-issue 단계 4-6 (계획/구현/테스트 슬롯)"
```

---

## Task 5: 커밋·PR·머지·정리 단계 파일

**Files:**
- Create: `.claude/skills/work-issue/steps/07-commit-push.md`
- Create: `.claude/skills/work-issue/steps/08-create-pr.md`
- Create: `.claude/skills/work-issue/steps/09-auto-merge.md`
- Create: `.claude/skills/work-issue/steps/10-cleanup.md`

- [ ] **Step 1: `07-commit-push.md` 작성**

````markdown
# 단계 7: 커밋 + 푸시

## 처리

1. `executing-plans`가 이미 만든 커밋들이 있으면 메시지 prefix 검사:
   ```bash
   git log main..HEAD --pretty=format:"%H %s"
   ```
   `[ISSUE-$ISSUE_NUMBER]`로 시작하지 않는 커밋이 있으면 사용자에게 알리고
   다음 중 선택을 받는다:
   - rebase로 메시지 일괄 수정 (안전한 경우만)
   - 그대로 두기 (PR 머지가 squash라 최종 메시지는 PR 제목으로 결정됨)

2. staged 변화가 남아 있으면:
   ```bash
   git add -A
   git diff --cached --stat
   ```
   변경 성격에서 `<type>` 추정: feat(신규 파일/기능) / fix(버그 수정) / docs(.md만) / refactor(동작 동일).
   plan 파일의 `# ` 첫 헤딩을 `<요약>`으로 사용.
   ```bash
   git commit -m "[ISSUE-$ISSUE_NUMBER] <type>: <요약>"
   ```

3. 푸시:
   ```bash
   git push -u origin "$BRANCH_NAME"
   ```

## 실패 시

- push 거부(보호 룰/권한): 출력 보여주고 사용자에게 알림. 브랜치는 보존.
- pre-commit hook 실패: 메시지에 따라 안내.
````

- [ ] **Step 2: `08-create-pr.md` 작성**

````markdown
# 단계 8: PR 생성 + 게이트 2

## 제목 규칙

`[ISSUE-$ISSUE_NUMBER] <제목 일부>`

`<제목 일부>`는 `$ISSUE_TITLE`에서 대괄호 prefix 토큰(`[FE]`, `[Design]`, `[BE]` 등)을 제거한 나머지를 사용한다. 예: `[FE] Android QT 위젯에 묵상 질문 표시` → `Android QT 위젯에 묵상 질문 표시`.

## body 생성

`references/pr-body-template.md`를 읽어 다음 자리표시자를 치환:
- `{ISSUE_NUMBER}`
- `{PLAN_SUMMARY}` — `$PLAN_PATH` 파일에서 `## 개요` 섹션 본문, 없으면 첫 비어있지 않은 단락
- `{COMMIT_LIST}` — `git log main..HEAD --pretty=format:"- %s"` 출력
- `{TEST_NOTE}` — 슬롯 비활성 동안 `_(테스트 슬롯 비활성)_`

## 명령

```bash
gh pr create \
  --title "[ISSUE-$ISSUE_NUMBER] <제목 일부>" \
  --body "$PR_BODY" \
  --base main \
  --head "$BRANCH_NAME"
```

`$PR_URL`/`$PR_NUMBER`를 출력에서 추출해 저장.

## 게이트 2

사용자에게 보여줄 것:
- `$PR_URL`
- `git diff --stat main..HEAD` 요약
- 커밋 목록

질문: "auto-merge를 활성화할까요? (머지 / 보류 / 중단)"

응답:
- "머지" → 단계 9로
- "보류" → 단계 10 cleanup도 건너뛰고 종료. 사용자가 직접 PR을 검토/머지.
- "중단" → 단계 10 cleanup으로(브랜치는 원격에 남음).
````

- [ ] **Step 3: `09-auto-merge.md` 작성**

````markdown
# 단계 9: auto-merge 활성화

## 명령

```bash
gh pr merge "$PR_NUMBER" --squash --auto --delete-branch
```

`--delete-branch`로 머지 후 원격 브랜치 자동 삭제.

## 실패 시

- 보호 룰이 auto-merge를 허용하지 않음: 사용자에게 알리고 단계 10으로 진행하지 말 것(PR은 살려둠).
- CI가 이미 실패 상태: 출력에서 그 이유를 확인할 수 있도록 보여주고 종료(머지 보류).
````

- [ ] **Step 4: `10-cleanup.md` 작성**

````markdown
# 단계 10: cleanup

auto-merge가 활성화된 직후 실행한다 — 실제 머지 완료까지 기다리지 않는다(spec 결정).

## 명령

```bash
# cwd를 메인 repo로 복귀
cd "<repo-root>"

git worktree remove "$WORKTREE_PATH"
```

로컬 브랜치는 머지 완료 시점이 미정이라 자동 삭제하지 않는다.
원격 브랜치는 단계 9의 `--delete-branch` 옵션이 머지 시 처리한다.

사용자에게 알림:
- "워크트리 정리 완료. 로컬 브랜치 `$BRANCH_NAME`은 머지 완료 후 `git branch -d`로 직접 삭제하세요."

## 실패 시

worktree에 커밋되지 않은 변경이 있으면 `git worktree remove`가 거부한다.
사용자에게 출력을 보여주고 "강제 삭제 / 보존" 선택을 받는다 — 강제 삭제는 사용자 명시 동의 없이 하지 않는다.
````

- [ ] **Step 5: 커밋**

```bash
git add .claude/skills/work-issue/steps/07-commit-push.md \
        .claude/skills/work-issue/steps/08-create-pr.md \
        .claude/skills/work-issue/steps/09-auto-merge.md \
        .claude/skills/work-issue/steps/10-cleanup.md
git commit -m "[ISSUE-WI] feat: work-issue 단계 7-10 (커밋/PR/머지/정리)"
```

---

## Task 6: references 파일

**Files:**
- Create: `.claude/skills/work-issue/references/pr-body-template.md`
- Create: `.claude/skills/work-issue/references/failure-recovery.md`

- [ ] **Step 1: `pr-body-template.md` 작성**

````markdown
## 이슈
Closes #{ISSUE_NUMBER}

## 요약
{PLAN_SUMMARY}

## 변경점
{COMMIT_LIST}

## 테스트
{TEST_NOTE}
````

- [ ] **Step 2: `failure-recovery.md` 작성**

````markdown
# 실패 시 복구 정책

## 공통 원칙

- 단계 실패 → 즉시 중단. 사용자에게 단계 이름 + 명령 + 출력을 제시.
- worktree와 로컬 브랜치는 자동으로 지우지 않는다 (작업 손실 방지).
- 사용자가 명시적으로 cleanup을 지시할 때만 제거.

## 단계별 액션

| 단계 | 실패 사례 | 액션 |
|------|----------|------|
| 1 이슈 로드 | gh 인증 / 번호 무효 | `gh auth status` 안내 + 종료 |
| 2 worktree 생성 | 경로 충돌 | 사용자에게 재사용/삭제 선택 |
| 3 셋업 | yarn / pod 실패 | 출력 보여주고 재시도 / 중단 |
| 4 계획 | writing-plans 자체 실패 | 사용자에게 그대로 전달 |
| 5 구현 | executing-plans 체크포인트 / 실패 | 그 상태 그대로 사용자에게, worktree 보존 |
| 6 테스트 슬롯 | (현재 무) | 슬롯이 채워졌을 때 정의 |
| 7 커밋·푸시 | push 거부 / hook 실패 | 메시지 그대로, 브랜치 보존 |
| 8 PR 생성 | 권한 / 중복 | 기존 PR 있으면 그것 재사용 제안 |
| 9 auto-merge | 보호 룰 / CI 실패 | 단계 10 건너뛰고 PR 살림 |
| 10 cleanup | worktree에 미커밋 변경 | 강제 삭제는 사용자 동의 후 |
````

- [ ] **Step 3: 커밋**

```bash
git add .claude/skills/work-issue/references/pr-body-template.md \
        .claude/skills/work-issue/references/failure-recovery.md
git commit -m "[ISSUE-WI] feat: work-issue references (pr 템플릿/실패 복구)"
```

---

## Task 7: dogfood 검증 (수동)

**Files:** 없음 (산출물은 운영 결과)

이 task는 코드 변경이 아니라 실제 워크플로우를 한 번 돌려보는 검증이다.

- [ ] **Step 1: 진입점 인식 확인**

Claude Code 세션을 새로 시작 후 `/work-issue` 입력. 슬래시 커맨드가 인식되어 description이 표시되는지 확인.

기대: 인자 없이 실행 시 `gh issue list --state open --limit 20` 출력이 보이고 사용자에게 번호 선택을 요청.

- [ ] **Step 2: 게이트 1까지 dry-run**

오픈 이슈 중 비교적 작은 것을 골라 `/work-issue <num>` 실행. 게이트 1(plan 검토)에서 "중단"을 선택해 실제 코드 변경 없이 종료.

확인 사항:
- `.worktrees/issue-<num>/` 디렉터리가 생성됨
- `feature/issue-<num>` 브랜치가 존재함
- `yarn install` / `pod install`이 실행되어 worktree에서 빌드 가능 상태가 됨
- `docs/superpowers/plans/<date>-issue-<num>.md`가 생성됨

- [ ] **Step 3: 보존 정책 확인**

게이트 1에서 "중단" 선택 후 worktree와 브랜치가 **그대로 남아있는지** 확인. spec의 "자동 삭제 안 함" 정책이 지켜지는지 검증.

수동 정리:
```bash
git worktree remove .worktrees/issue-<num>
git branch -D feature/issue-<num>
```

- [ ] **Step 4: 결과 기록**

검증 중 발견한 이슈는 `docs/superpowers/specs/2026-04-26-work-issue-workflow-design.md`의 "오픈 이슈 / 후속 작업" 섹션에 추가하거나 별도 GitHub 이슈로 작성.

---

## Self-Review 결과

- **Spec 커버리지**: spec의 단계 1-10, 게이트 2개, 데이터 흐름, 테스트 슬롯, 실패 처리 모두 task에 매핑됨.
- **placeholder 스캔**: "TBD" 등 없음. 자리표시자(`{ISSUE_NUMBER}` 등)는 PR body 템플릿에서 의도된 형태로만 사용.
- **타입/이름 일관성**: 변수명(`$ISSUE_NUMBER`, `$WORKTREE_PATH`, `$BRANCH_NAME`, `$PLAN_PATH`, `$PR_NUMBER`, `$PR_URL`)이 SKILL.md 정의와 각 step에서 동일하게 사용.
- **외부 의존**: gh CLI, git ≥2.5(worktree), yarn, (macOS) CocoaPods. RN 프로젝트 표준 셋업이라 추가 가정 없음.
