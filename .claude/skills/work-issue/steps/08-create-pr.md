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
