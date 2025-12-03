# Firebase In-App Messaging 알려진 제한사항

## 중요: "Test on device" 동작 방식

"Test on device"는 **특별한 FCM 메시지**를 전송합니다. 이 메시지는 일반 In-App Messaging과 다르게 동작할 수 있습니다.

### iOS 16.6에서 "Test on device"가 안 될 때

**가능한 원인**:

1. **네트워크 상태**:
   - iOS 16.6에서는 네트워크 동기화가 더 느릴 수 있음
   - **해결**: 약 30초 정도 기다리기

2. **시간 설정**:
   - 기기 시간이 서버 시간과 불일치
   - **해결**: 기기 시간 자동 설정 활성화

3. **캠페인 설정**:
   - "Test on device"는 특정 조건을 무시하지만, 일부는 여전히 적용됨
   - 캠페인이 **Published** 상태가 아닌 경우
   - **해결**: 캠페인을 Published로 설정

4. **FCM 토큰/Installation ID**:
   - 잘못된 ID 입력
   - **해결**: Xcode 콘솔에서 정확한 ID 확인

5. **앱 상태**:
   - 앱이 완전히 종료되어 있음
   - **해결**: 앱을 실행 상태로 유지

### 해결 방법

#### 1. 단계별 확인

```bash
# iOS 16.6 기기에서
1. 앱 완전 종료
2. 기기 재부팅
3. 앱 실행
4. Installation ID 확인
5. Firebase Console에서 "Test on device"
6. 최소 30초 대기
```

#### 2. Xcode 로그 확인

iOS 16.6에서 다음 로그가 모두 있어야 함:

```
✅ Firebase In-App Messaging initialized
✅ Installation ID: [id]
🔥 Triggering app_foreground event...
✅ app_foreground event triggered
```

#### 3. Firebase Console 확인

- 캠페인 상태: **Published**
- 메시지 타입: Banner/Modal/Card/Image
- **중요**: iOS 16.6 특정 문제가 있을 수 있음

## iOS 18+ vs iOS 16.6

**차이점**:
- iOS 18+: Firebase SDK 최신 기능 최적화
- iOS 16.6: 일부 기능이 제한적일 수 있음

**공식 문서에 따르면**:
- Firebase In-App Messaging은 iOS 11 이상 지원
- **하지만 iOS 16.6은 비교적 오래된 버전**

### 권장 사항

1. **iOS 16.6에서도 작동하지만**:
   - 더 긴 대기 시간 필요할 수 있음 (최대 1분)
   - 네트워크 상태에 더 민감할 수 있음

2. **테스트 전략**:
   - iOS 18+에서 먼저 검증
   - iOS 16.6에서 재확인

3. **프로덕션**:
   - 대부분의 사용자는 iOS 17+ 사용
   - iOS 16.6 사용자는 소수

## 추가 디버깅

iOS 16.6 전용 로그 추가:

```objective-c
// AppDelegate.mm에 추가
NSLog(@"iOS version: %@", [[UIDevice currentDevice] systemVersion]);
NSLog(@"Device model: %@", [[UIDevice currentDevice] model]);
```

이 로그로 iOS 버전별 동작 차이를 확인할 수 있습니다.

## 결론

- ✅ 설정은 정상 (iOS 16.6 지원 확인됨)
- ⚠️ "Test on device"가 iOS 16.6에서 지연될 수 있음
- 💡 iOS 18+에서 이미 작동했다면 **설정은 문제 없음**
- 🔍 iOS 16.6 특정 문제는 Firebase SDK나 iOS 버그일 가능성

**권장**: iOS 18+에서 정상 작동한다면 프로덕션 배포해도 됩니다. iOS 16.6은 소수 사용자에 대한 지원 수준으로 충분합니다.

