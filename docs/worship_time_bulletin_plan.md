# 📋 예배 시간 설정 및 주보 기반 말씀 안내 개발 계획서 (Plan)

- **Epic Issue**: [#184](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/184)
- **관련 기획**: [기획] 예배시간 설정 ([#168](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/168))

이 계획서는 만나교회 주보 크롤링 데이터와 매핑하여 사용자가 설정한 예배 시간에 맞추어 말씀 및 위젯을 제공하기 위한 설계안 및 태스크 분할(Epic/Issue) 문서입니다.

---

## 1. 개요 및 요구사항 정의

### 1.1. 배경 및 목적
- **기존 문제점**: 기존 시스템은 매주 한 개(주로 토요일)의 설교 데이터만 덮어쓰기 형태로 저장하고 있어, 토요일과 일요일의 설교 본문이나 제목이 다를 경우 일요일 예배 참석자에게 오기 안내가 되는 문제가 있었습니다.
- **해결 방안**: 주간 주보 데이터를 기반으로 5개 예배 시간대의 데이터를 모두 Firestore에 등록하고, 사용자가 앱에서 설정한 '내 예배 시간'에 맞춰 해당하는 말씀 콘텐츠를 보여주며 위젯에 연동합니다.

### 1.2. 핵심 요구사항
1. **예배 시간 목록**: 5가지 옵션 제공
   - 목요일(저녁) (`THU_EVE`)
   - 토요일(오후) (`SAT_PM`)
   - 일요일 10시 (기본값) (`SUN_1000`)
   - 일요일 12시 (`SUN_1200`)
   - 일요일 14시 30분 (`SUN_1430`)
2. **하위 호환성 유지**:
   - 구버전 앱은 기존 `'sermons'` 컬렉션에서 `date` 기준 최신 데이터를 그냥 읽어가도록 데이터 입력 순서 및 쿼리 하위 호환성을 유지합니다.
   - 신버전 앱에서 5개 전체 예배 데이터를 로컬에 리스트로 받아와 저장하고, 사용자 설정에 해당하는 말씀만 기존 `'fcm_sermon'` 캐시 키 및 iOS App Group에 덮어써 주어 네이티브 위젯 코드 변경을 최소화합니다.
3. **주간 데이터 동기화**:
   - 한 주(목요일~일요일)의 예배 데이터를 대표하는 일요일 날짜를 공통 `date` 키(YYYY-MM-DD)로 지정하여, 클라이언트가 단일 날짜 값으로 5개 예배 데이터를 한 번에 가져올 수 있게 합니다.

### 1.3. 시스템 범위 및 역할 분담 (Scope of Work)
- **본 리포지토리 (React Native 앱 - 개발 대상)**:
  - 예배 시간 설정 UI 개발, 로컬 캐시 구조화 및 동기화 모듈 개발, 홈 화면 및 말씀 조회 훅 수정, 기존 위젯 연동용 레거시 캐시 키 동기화 및 QA/모킹 툴 고도화.
- **타 리포지토리 (주보 크롤러, Firestore 업데이트 및 FCM 브로드캐스트 - 작업 제외)**:
  - 만나교회 주보 웹 크롤링 및 파싱, 주간 예배별 데이터 Firestore 적재 자동화, 주보 등록 완료 시점의 FCM Broadcast 푸시 전송.
  - *참고: 이 백엔드/크롤링 파트는 본 리포지토리의 작업 범위에서 제외되며 다른 리포지토리에서 처리됩니다.*

---

## 2. 아키텍처 및 데이터 흐름

### 2.1. Firestore 데이터 모델 (인터페이스 레벨)
기존 `'sermons'` 컬렉션에 `worship_type` 필드를 추가하여 개별 문서로 등록합니다.

```typescript
interface Sermon {
  id: string;
  title: string;
  content: string;
  date: string;              // 공통 주일 일자 (예: "2026-07-19" - 주간 바운더리)
  actual_date?: string;      // 실제 예배 일자 (예: "2026-07-16" - 목요예배)
  worship_type: 'THU_EVE' | 'SAT_PM' | 'SUN_1000' | 'SUN_1200' | 'SUN_1430'; 
  category?: string;
  day_of_week?: string;      // "THU" | "SAT" | "SUN"
  video_url?: string;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}
```

### 2.2. 클라이언트 캐싱 및 동기화 흐름
```
[Firestore] 
     │ (5개 예배 데이터 Fetch)
     ▼
[AsyncStorage]
     ├── 'weekly_sermons' : [Sermon, Sermon, ...] (5개 예배 전체 캐싱)
     │
     ▼ (사용자 선택 예배 필터링)
[Sync Selected Sermon]
     ├── 'fcm_sermon' : Selected Sermon (레거시 캐시 키 유지)
     ├── iOS App Group에 덮어쓰기
     └── Native Widget 갱신 (onSermonUpdated 호출)
```

---

## 3. 에픽 및 이슈 분할 (Epic & Issues)

### [EPIC-1] 예배 시간 설정 및 주보 기반 말씀 불러오기 ([#184](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/184))
- **관련 기획**: [기획] 예배시간 설정 ([#168](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/168))

#### 🎫 Issue 1: Firestore 데이터 모델 정의 및 클라이언트 타입 정의 ([#175](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/175))
- **작업 내용**:
  - `src/types/Sermon.ts` 파일의 `Sermon` 및 `SermonRaw` 인터페이스에 `worship_type` 필드와 `actual_date` 추가.
  - Firestore 쿼리 필터링에 사용할 `WorshipType` 상수 선언.
- **체크리스트**:
  - [ ] `Sermon` 타입 확장 완료
  - [ ] `WorshipType` 타입 및 Enum 정의 완료

#### 🎫 Issue 2: AsyncStorage 주간 말씀 캐시 도입 및 서비스 함수 구현 ([#176](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/176))
- **작업 내용**:
  - `src/services/sermonService.ts`에 주간 전체 말씀을 로컬에 캐싱하는 로직 추가.
    - 신규 캐시 키: `weekly_sermons`
  - 서버에서 가장 최신 날짜(`date`)의 문서들을 모두 가져오는 `fetchLatestWeeklySermonsFromServer()` 구현.
  - 선택된 예배 시간에 맞추어 `fcm_sermon`과 iOS App Group에 덮어쓰고 Native Widget을 갱신해 주는 `syncSelectedSermonToWidget(worshipType: WorshipType)` 헬퍼 구현.
- **체크리스트**:
  - [ ] `weekly_sermons` 캐시 저장/읽기 함수 작성
  - [ ] 최신 주간 말씀 일괄 Fetch 함수 작성
  - [ ] 사용자 설정 기반 레거시 동기화 및 위젯 노티 모듈 구현

#### 🎫 Issue 3: SettingsScreen 내 예배 시간 설정 UI 개발 ([#177](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/177))
- **작업 내용**:
  - `src/screens/SettingsScreen.tsx`에 "예배 시간 설정" 섹션 추가.
  - 그리드 카드 디자인으로 5가지 예배 옵션을 미려하게 렌더링.
  - 사용자가 예배 시간을 변경하면 AsyncStorage(`user_worship_setting`)에 저장하고 `syncSelectedSermonToWidget()`을 호출하여 화면과 위젯을 즉시 새로고침.
- **체크리스트**:
  - [ ] 그리드 카드 라디오 버튼 UI 컴포넌트 추가
  - [ ] 선택 변경 시 AsyncStorage 저장 및 동기화 처리 연동
  - [ ] 데이터 새로고침 기능 실행 시에도 설정된 예배 시간이 유효하게 반영되는지 확인

#### 🎫 Issue 4: HomeScreen 및 useSermonData 훅 수정 ([#178](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/178))
- **작업 내용**:
  - `src/hooks/useSermonData.ts` 수정:
    - 로컬 캐시를 검사할 때 `weekly_sermons`에서 사용자 설정(`user_worship_setting`)에 부합하는 예배 말씀 데이터를 먼저 반환하도록 수정.
    - 서버에서 데이터를 폴링/동기화할 때, 개별 Fetch가 아닌 5개 예배 일괄 Fetch를 진행하고 로컬 캐시를 갱신하도록 변경.
- **체크리스트**:
  - [ ] `useSermonData` 캐시 로딩 우선순위 수정 완료
  - [ ] Firestore 구독 및 동기화 로직 갱신 완료

#### 🎫 Issue 5: FCM 푸시 리스너 업데이트 ([#179](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/179))
- **작업 내용**:
  - 백그라운드 및 포그라운드에서 주보 업데이트 알림(FCM) 수신 시, 알림 속 날짜 기준으로 Firestore에서 5개 예배 데이터를 일괄 Fetch하여 `weekly_sermons` 캐시를 업데이트하고 설정된 예배 말씀 정보를 갱신하도록 리스너 보강.
- **체크리스트**:
  - [ ] FCM 수신 시 로컬 캐시 동기화 로직 연동 완료
  - [ ] 백그라운드 수신 후 위젯 트리거 갱신 여부 테스트

#### 🎫 Issue 6: 로컬 QA 및 test_fcm.js 시나리오 모킹 추가 ([#180](https://github.com/MannaDevelopers/meditation_blossom_frontend/issues/180))
- **작업 내용**:
  - [test_fcm.js](file:///Users/minchul/Projects/meditation_blossom_frontend/scripts/test_fcm.js)에 신규 5개 예배 타임 데이터를 각각 Firestore 에뮬레이터/실제 DB에 모의 등록하는 코드 추가.
  - 사용자가 설정을 바꿀 때 화면과 위젯에 반영되는지 통합 테스트 검증 진행.
- **체크리스트**:
  - [ ] `test_fcm.js`에 주보 업데이트 테스트 시나리오 구현
  - [ ] 앱 설정 변경 -> 위젯 동시 갱신 정상 동작 검증
