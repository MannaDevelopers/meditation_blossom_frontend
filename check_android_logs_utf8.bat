@echo off
REM UTF-8 인코딩 설정
chcp 65001 >nul
echo Android FCM 로그 확인 (UTF-8)...
echo FCM 메시지를 전송한 후 로그를 확인하세요.
echo.

REM 로그 버퍼 클리어
adb logcat -c

REM 전체 MyFirebaseMessagingService 로그 출력
adb logcat -v time *:S MyFirebaseMessagingService:D

