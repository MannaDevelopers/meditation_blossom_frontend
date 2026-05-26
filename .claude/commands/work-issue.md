---
description: GitHub 이슈 1건을 받아 worktree 분기 → 계획 → 구현 → PR → auto-merge까지 자동화
argument-hint: <issue-number>
---

work-issue 스킬을 호출해 이슈 작업을 시작한다.

인자 처리:
- `$ARGUMENTS`가 숫자면 그 이슈 번호를 사용한다.
- 비어 있으면 `gh issue list --state open --limit 20`을 실행해 사용자에게 보여주고 번호 선택을 받는다.

이후 `meditation_blossom_frontend/.claude/skills/work-issue/SKILL.md`의 흐름을 따른다.
