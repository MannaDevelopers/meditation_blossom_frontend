# 매일 만나 (카드형) 위젯 본문 클릭 시 링크 이동 불가

## 요약

"매일 만나 (카드형)" 홈 화면 위젯에서 본문 말씀 영역을 탭해도 앱 또는 유튜브 링크로 이동하지 않는 버그. 제목 영역을 탭할 때만 정상 이동함.

## 재현 단계

1. Android 홈 화면에 "매일 만나 (카드형)" 위젯 추가
2. 위젯의 **제목** 영역 탭 → 앱 또는 유튜브로 정상 이동 (이동 O)
3. 위젯의 **본문 말씀** 영역 탭 → 아무 반응 없음 (이동 X)

## 예상 동작

위젯의 어느 영역을 탭해도 앱(매일 만나 탭) 또는 유튜브 링크로 이동해야 함.  
주일 말씀 (카드형) 위젯은 본문을 탭해도 정상 이동함.

## 실제 동작

본문 말씀 영역(성경 참조, 구절, 묵상 질문)을 탭해도 아무 반응 없음.

## 원인 분석

`QtWidgetSmall.kt`의 `LazyColumn` 내부 `Text` 아이템에 `.clickable(clickAction)` modifier가 없음.

Glance `LazyColumn`은 부모 컴포저블의 `clickable` modifier를 자식에게 전파하지 않음.  
따라서 `LazyColumn` 바깥의 제목 텍스트는 부모 `Column`의 `.clickable`로 동작하지만,  
`LazyColumn` 내부 아이템은 터치 이벤트를 흡수하여 부모 clickable이 호출되지 않음.

**비교 현황:**

| 파일 | LazyColumn 내부 clickable |
|------|--------------------------|
| `VerseWidgetSmall.kt` (주일 말씀 카드형) | ✅ 각 verse Text에 `.clickable(clickAction)` 있음 |
| `QtWidgetSmall.kt` (매일 만나 카드형) | ❌ 모든 Text에 `.clickable` 없음 |
| `QtWidgetLarge.kt` (매일 만나 배너형) | ⚠️ verses/questions에는 있으나 reference·라벨에는 없음 |

## 수정 파일

- `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetSmall.kt`
  - `LazyColumn` 내부 모든 `Text`에 `.clickable(clickAction)` 추가
  - 대상: reference, verses, 묵상 질문 라벨, 개별 question 텍스트
- `android/app/src/main/java/app/mannadev/meditation/ui/widget/QtWidgetLarge.kt`
  - 누락된 reference, 묵상 질문 라벨 `Text`에 `.clickable(clickAction)` 추가

## 레이블

`bug` `android` `widget`
