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
