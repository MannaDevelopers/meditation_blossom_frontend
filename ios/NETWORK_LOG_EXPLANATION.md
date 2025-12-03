# iOS 네트워크 로그에 대한 설명

## 이 로그가 무엇인가요?

```
[connection] nw_connection_get_connected_socket_block_invoke [C1770] Client called nw_connection_get_connected_socket on unconnected nw_connection
TCP Conn 0x2800014a0 Failed : error 0:61 [61]
```

이 로그는 **React Native Metro bundler**가 디버깅 연결을 시도할 때 발생하는 경고입니다.

## 왜 발생하나요?

### 1. **시뮬레이터/실기기와 Metro 서버 연결**
- React Native는 개발 모드에서 Metro bundler (localhost)에 연결을 시도합니다
- 때때로 타임아웃이나 실패가 발생할 수 있습니다
- **iOS 시스템 레벨 로그**이므로 자동으로 표시됩니다

### 2. **억제 설정의 한계**
```objective-c
// AppDelegate.mm
[[NSUserDefaults standardUserDefaults] setBool:NO forKey:@"NSURLSessionVerboseLogging"];
```

이 설정은 **일부 네트워크 로그만 억제**합니다:
- ✅ NSURLSession 관련 로그는 억제됨
- ❌ 시스템 레벨(nw_connection) 로그는 억제 안 됨

### 3. **error 0:61 [61]의 의미**
- **61**: Connection refused
- Metro 서버가 일시적으로 응답하지 않거나 타임아웃된 경우

## 해결 방법

### 방법 1: 무시하기 (권장)
이 로그는 **앱 동작에 전혀 영향이 없습니다**. 무시해도 됩니다.

### 방법 2: Xcode 콘솔 필터링
1. Xcode에서 `⌘ + Shift + Y` (콘솔 열기)
2. 상단 검색창에 필터 적용:
   - 포함할 단어: `FCM`, `sermon_events`, `widget`
   - 제외할 단어: `nw_connection`, `TCP Conn`

### 방법 3: Release 빌드 사용
Release 빌드에서는 Metro가 없으므로 이 로그가 안 나타납니다:

```bash
# Release 빌드
npx react-native run-ios --configuration Release
```

## 왜 이제 더 많이 보이나요?

1. **Firebase In-App Messaging 추가**: 더 많은 네트워크 연결이 발생
2. **디버그 로그 정리 후**: 유용한 로그가 줄어서 시스템 로그가 더 눈에 띄임
3. **iOS 16.6 특성**: 시스템 로그가 더 자세하게 표시될 수 있음

## 확인해야 할 로그

이런 로그가 보이면 **정상 동작**입니다:

```
알림 권한 부여
APNS device token received
Successfully subscribed to sermon_events topic
```

## 결론

✅ **이 로그는 정상입니다**
✅ **앱 기능에 영향 없음**
✅ **프로덕션 빌드에서는 나타나지 않음**
✅ **무시해도 됩니다**

