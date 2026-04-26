# 단계 9: auto-merge 활성화

## 명령

```bash
gh pr merge "$PR_NUMBER" --squash --auto --delete-branch
```

`--delete-branch`로 머지 후 원격 브랜치 자동 삭제.

## 실패 시

- 보호 룰이 auto-merge를 허용하지 않음: 사용자에게 알리고 단계 10으로 진행하지 말 것(PR은 살려둠).
- CI가 이미 실패 상태: 출력에서 그 이유를 확인할 수 있도록 보여주고 종료(머지 보류).
