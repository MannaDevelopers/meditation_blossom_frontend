# iOS Widget 디버깅 가이드

Xcode에서 위젯 확장을 디버깅하는 방법을 안내합니다.

## 1. 위젯 확장 디버깅 설정

### 1.1. 디버그 타겟 선택

1. Xcode 상단 바에서 디버그 실행 시킬 타겟을 선택합니다
2. 타겟 선택 드롭다운에서 **`MeditationBlossomWidgetExtension`** 선택
3. 실행할 시뮬레이터나 실제 기기를 선택

### 1.2. 디버그 실행

위젯 확장 타겟 선택 후 실행 버튼(▶️)을 누르거나 `Cmd + R`을 누릅니다.

Xcode가 위젯 확장 프로세스를 시작하고, 위젯의 로그를 콘솔에 출력합니다.

## 2. 위젯 타임라인 트리거하기

위젯 디버깅을 위해 타임라인을 수동으로 트리거해야 합니다.

### 2.1. 단축키 사용

1. 위젯 확장이 실행 중인 시뮬레이터/기기에서
2. **`Cmd + Shift + M`** (또는 시뮬레이터 메뉴의 Device > Trigger Timelines)

이 명령어는 모든 위젯의 타임라인을 즉시 갱신합니다.

### 2.2. 위젯을 홈 화면에 추가

1. 시뮬레이터/기기의 홈 화면을 롱프레스
2. 왼쪽 상단의 `+` 버튼 클릭
3. "묵상만개" 또는 "MeditationBlossomWidget" 검색
4. 위젯 크기 선택 후 "위젯 추가" 클릭

위젯이 홈 화면에 추가되면 자동으로 타임라인이 로드됩니다.

### 2.3. 위젯 롱프레스로 갱신

홈 화면에 위젯이 있다면:
1. 위젯을 롱프레스
2. "위젯 새로고침" 또는 "Edit Widget" 메뉴 선택

## 3. 로그 확인

위젯 확장 디버깅 시 다음과 같은 로그를 확인할 수 있습니다:

```
타임라인 로딩
{'displaySermon'에 해당하는 문자열을 찾을 수 없습니다.}  // 데이터가 없을 때
✅ Widget: Found sermon data - [토요설교] 18. 하나님 안에 거하기(안식)  // 데이터 있을 때
❌ Widget: No sermon data found in App Group  // 디코딩 실패 시
JSON 디코딩 실패: ...  // JSON 파싱 오류 시
```

## 4. 브레이크포인트 사용

위젯 코드에 브레이크포인트를 설정할 수 있습니다:

1. `ios/MeditationBlossomWidget/MeditationBlossomWidget.swift` 파일을 엽니다
2. 원하는 줄 번호 옆에 클릭하여 브레이크포인트 설정
3. 특히 다음 위치에 브레이크포인트 설정하면 유용합니다:
   - `createSermonEntry()` 함수 시작 부분 (line 37)
   - `getObjectFromString()` 호출 후 (line 40)
   - 디코딩 성공/실패 분기점

## 5. App Group 데이터 확인

디버깅 중 App Group 데이터를 직접 확인하려면:

1. 디버그 콘솔에서 다음 명령어 실행:
   ```lldb
   po UserDefaults(suiteName: "group.mannachurch.meditationblossom")
   ```

2. 또는 `Sermon.swift`의 `getObjectFromString()` 메서드에 있는 `print(jsonString)` 로그 확인

## 6. 실제 FCM 시나리오 디버깅

### 6.1. 정리된 디버깅 플로우

1. **앱 타겟 선택**: `meditation_blossom` 타겟 선택 후 실행 (실제 앱)
2. **위젯 확장 타겟 선택**: 시도 > Device > Trigger Timelines (위젯)
3. **백그라운드 FCM 테스트**:
   - 앱을 백그라운드로 보냅니다
   - `node test_fcm.js sendDataOnly sermon_events` 실행
   - Xcode 콘솔에서 AppDelegate 로그 확인
   - 시뮬레이터에서 `Cmd + Shift + M` 눌러 위젯 타임라인 트리거
   - 위젯 확장 로그 확인

4. **포그라운드 전환 후 디버깅**:
   - 앱을 포그라운드로 전환
   - HomeScreen 로그 확인 (`✅ Widget updated successfully`)
   - 앱을 다시 백그라운드로 전환
   - `Cmd + Shift + M` 눌러 위젯 타임라인 트리거
   - 위젯 확장 로그에서 `❌ Widget: No sermon data found` 여부 확인

## 7. 주의사항

- 위젯 확장은 별도의 프로세스이므로 메인 앱과 다른 콘솔에서 로그가 출력됩니다
- 위젯 타임라인은 배터리 최적화를 위해 자동으로 관리되며, iOS가 정한 스케줄에 따라 갱신됩니다
- `Cmd + Shift + M`은 개발 중에만 사용 가능한 디버깅 도구입니다
- 실제 기기에서는 위젯 타임라인이 더 빈번하게 갱신될 수 있습니다

## 8. 일반적인 문제 해결

### 문제: "위젯에 데이터가 안 나타남"

**확인 사항**:
1. App Group 데이터가 저장되어 있는지 확인 (위젯 로그에 JSON 문자열 출력)
2. JSON 디코딩이 성공하는지 확인 (에러 메시지 없음)
3. 위젯 타임라인이 트리거되는지 확인 (`타임라인 로딩` 로그)

**해결책**:
- `Sermon.swift`의 `getObjectFromString()` 메서드에 더 상세한 로깅 추가
- 위젯 타임라인 수동 트리거 (`Cmd + Shift + M`)
- 시뮬레이터 재부팅

### 문제: "JSON 디코딩 실패"

**확인 사항**:
1. ISO 문자열이 Firestore 타임스탬프로 변환되지 않았는지 확인
2. JSON 구조가 예상과 다른지 확인

**해결책**:
- `Sermon.swift`에서 ISO 문자열을 지원하도록 디코더 커스터마이징
- 또는 `AppDelegate.mm`에서 ISO 문자열을 Firestore 타임스탬프로 변환

