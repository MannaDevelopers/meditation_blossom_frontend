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
