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
