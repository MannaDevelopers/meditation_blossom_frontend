# 단계 1: 이슈 메타 로드

## 명령

```bash
gh issue view $ISSUE_NUMBER --json number,title,body,labels,state
```

## 처리

- 출력 JSON에서 `number`/`title`/`body`/`labels`를 추출해 상태 변수에 저장한다.
- `state`가 `closed`면 사용자에게 "이미 닫힌 이슈입니다. 계속할까요?" 확인.
- 인증 실패(401/403) 시 `gh auth status`를 안내하고 중단.

## 실패 시

`references/failure-recovery.md`의 "이슈 로드 실패" 항목 참조.
