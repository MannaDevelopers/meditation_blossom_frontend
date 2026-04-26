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
