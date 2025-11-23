# Xcode 콘솔 필터링 가이드

iOS 앱을 디버깅할 때 네트워크 연결 로그가 너무 많이 출력되어 중요한 로그를 찾기 어려운 경우가 있습니다.

## 해결 방법: Xcode 콘솔 필터 사용

### 1. Xcode에서 로그 보기
1. Xcode 실행
2. 왼쪽 하단 **"View Debug Area"** (Cmd+Shift+Y) 클릭
3. 하단 콘솔 창 확인

### 2. 콘솔 필터 설정
콘솔 창 **상단 검색 바**에 필터를 입력:

#### 예시 1: FCM 관련 로그만 보기
```
=== FCM
```
또는
```
FCM
```

#### 예시 2: 특정 키워드 제외
```
-not:connection -not:nw_connection -not:TCP
```

#### 예시 3: 우리가 추가한 로그만 보기
```
📝
```

#### 예시 4: 성공 로그만 보기
```
✅
```

## 자주 사용하는 필터 패턴

### FCM 메시지 디버깅
```
FCM|Firebase|📝|✅|❌
```

### 위젯 업데이트 확인
```
Widget|displaySermon|fcm_sermon
```

### 모든 디버그 로그
```
=== |📝|✅|❌|⚠️
```

## Xcode 콘솔 단축키

- **View Debug Area**: `Cmd+Shift+Y`
- **Clear Console**: `Cmd+K`
- **Search**: `Cmd+F`
- **Show/Hide Preview**: `Opt+Cmd+Enter`

## 참고

`nw_connection` 관련 로그는 iOS 시스템 레벨의 네트워크 스택에서 자동으로 출력되는 로그입니다. 이는 앱의 정상 동작을 방해하지 않으며, Xcode 콘솔 필터로 쉽게 숨길 수 있습니다.

## 추가 팁

### 로그 레벨 조정
네이티브 코드에서 로그 레벨을 조정하려면 `AppDelegate.mm`의 `didFinishLaunchingWithOptions`에서:
```objective-c
// 이미 추가됨
[[NSUserDefaults standardUserDefaults] setBool:NO forKey:@"NSURLSessionVerboseLogging"];
```

### 민감한 정보 숨기기
프로덕션에서는 중요하지 않은 로그를 제거하거나 비활성화:
```objective-c
#ifdef DEBUG
NSLog(@"디버그 로그");
#endif
```

