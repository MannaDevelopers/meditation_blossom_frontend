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
