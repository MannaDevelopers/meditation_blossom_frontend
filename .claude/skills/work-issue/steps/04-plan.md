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
