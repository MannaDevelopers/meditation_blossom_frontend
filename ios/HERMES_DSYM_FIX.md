# Hermes dSYM Warning 해결 가이드

## 문제
App Store Connect로 업로드할 때 다음과 같은 경고가 나타납니다:
```
The archive did not include a dSYM for the hermes.framework with the UUIDs [868EB177-BBF5-3323-9ED4-BA1070ACE7A3]. 
Ensure that the archive's dSYM folder includes a DWARF file for hermes.framework with the expected UUIDs.
```

## 해결 방법

### Xcode에서 Build Phase 추가하기

1. Xcode에서 프로젝트를 엽니다
2. Project Navigator에서 `meditation_blossom` 프로젝트를 선택합니다
3. `meditation_blossom` 타겟을 선택합니다
4. Build Phases 탭으로 이동합니다
5. 왼쪽 상단의 `+` 버튼을 클릭하고 "New Run Script Phase"를 선택합니다
6. 새로운 스크립트를 목록 맨 아래로 드래그합니다 (Embed Foundation Extensions 다음)
7. 스크립트 이름을 "Copy Hermes dSYM"으로 변경합니다
8. 아래 스크립트를 입력합니다:

```bash
# Copy Hermes dSYM to app dSYM folder
HERMES_DSYM_SOURCE="${PODS_CONFIGURATION_BUILD_DIR}/hermes-engine/hermes.framework.dSYM"

if [ -d "$HERMES_DSYM_SOURCE" ]; then
    echo "Copying Hermes dSYM..."
    ditto "$HERMES_DSYM_SOURCE" "${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"
    echo "Hermes dSYM copied successfully"
else
    echo "Hermes dSYM not found at $HERMES_DSYM_SOURCE"
fi
```

9. "Run script only when installing" 옵션을 체크합니다
10. Xcode를 저장하고 닫습니다

### Archive 및 업로드

1. Clean Build Folder 실행 (Shift+Cmd+K)
2. Archive 생성 (Product > Archive)
3. App Store Connect로 업로드
4. 이제 경고가 사라집니다!

## 참고사항

- 이미 `ios/copy-hermes-dsym.sh` 스크립트 파일이 생성되어 있습니다
- Podfile에 Hermes dSYM 설정이 추가되어 있습니다
- 문제가 계속되면 DerivedData를 삭제하고 다시 시도하세요
