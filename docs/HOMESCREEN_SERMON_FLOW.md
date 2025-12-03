# HomeScreen Sermon Data Selection Flow

## 앱 실행 시 Sermon 데이터 선정 Flow Chart

```mermaid
flowchart TD
    Start([앱 실행<br/>HomeScreen 마운트]) --> Init[useEffect: initializeData 호출]
    
    Init --> LoadLocal[loadLocalData 호출]
    
    LoadLocal --> FetchFirestoreCache[latestSermonFromFirestoreCache<br/>Firestore 캐시에서 최신 설교 조회]
    LoadLocal --> FetchAsyncStorage[latestSermonFromAsyncStorage<br/>AsyncStorage에서 최신 설교 조회]
    
    FetchFirestoreCache --> FirestoreResult{Firestore<br/>캐시<br/>있음?}
    FetchAsyncStorage --> AsyncResult{AsyncStorage<br/>데이터<br/>있음?}
    
    FirestoreResult -->|있음| FirestoreData[firestoreDocToSermon<br/>Sermon 객체로 변환]
    FirestoreResult -->|없음| FirestoreNull[null 반환]
    
    AsyncResult -->|있음| AsyncData[fcmDataToSermon<br/>Sermon 객체로 변환]
    AsyncResult -->|없음| AsyncNull[null 반환]
    
    FirestoreData --> Compare[compareSermon<br/>두 데이터 비교<br/>date → updated_at 순서]
    FirestoreNull --> Compare
    AsyncData --> Compare
    AsyncNull --> Compare
    
    Compare --> BothNull{둘 다<br/>null?}
    BothNull -->|예| NoData[setSermon null<br/>데이터 없음 표시]
    BothNull -->|아니오| SelectNewer{어느 것이<br/>더 최신?}
    
    SelectNewer -->|Firestore >= AsyncStorage| SelectFirestore[selectedSermon = Firestore 캐시]
    SelectNewer -->|AsyncStorage > Firestore| SelectAsync[selectedSermon = AsyncStorage]
    
    SelectFirestore --> SetSermon1[setSermon selectedSermon]
    SelectAsync --> SetSermon1
    SetSermon1 --> CheckInvalidate
    
    NoData --> CheckInvalidate
    
    CheckInvalidate[checkInvalidate<br/>선택된 sermon의 date 확인]
    CheckInvalidate --> DateNull{date가<br/>null?}
    DateNull -->|예| FetchServer1[fetchDataFromServer 호출]
    DateNull -->|아니오| CheckWeek{1주일 이상<br/>오래됨?}
    CheckWeek -->|예| FetchServer1
    CheckWeek -->|아니오| End1([초기화 완료])
    
    FetchServer1 --> QueryServer[Firestore 서버 쿼리<br/>orderBy date desc, limit 1]
    QueryServer --> ServerEmpty{서버에<br/>데이터 있음?}
    ServerEmpty -->|없음| End1
    ServerEmpty -->|있음| ConvertServer[firestoreDocToSermon<br/>서버 데이터를 Sermon으로 변환]
    ConvertServer --> SetSermonServer[setSermon latestSermon<br/>서버에서 가져온 최신 데이터로 업데이트]
    SetSermonServer --> End1
    
    style Start fill:#e1f5ff
    style End1 fill:#c8e6c9
    style NoData fill:#ffcdd2
    style FetchServer1 fill:#fff9c4
    style SetSermonServer fill:#c8e6c9
```

## 추가 데이터 업데이트 Flow

### 1. FCM 이벤트 수신 시
```mermaid
flowchart LR
    FCMEvent[FCM 이벤트 수신<br/>ON_SERMON_UPDATE] --> LoadLocal2[loadLocalData 호출]
    LoadLocal2 --> Compare2[compareSermon으로 비교]
    Compare2 --> SetSermon2[setSermon 업데이트]
```

### 2. 앱 포그라운드 복귀 시 (iOS)
```mermaid
flowchart TD
    Foreground[앱 포그라운드로 복귀<br/>AppState = 'active'] --> SyncAppGroup[syncAppGroupData 호출]
    SyncAppGroup --> ReadAppGroup[App Group에서<br/>displaySermon 읽기]
    ReadAppGroup --> HasData{데이터<br/>있음?}
    HasData -->|예| Normalize[normalizeJsonString<br/>JSON 정규화]
    HasData -->|아니오| LoadLocal3[loadLocalData 호출]
    Normalize --> CompareSig{서명이<br/>변경됨?}
    CompareSig -->|예| CopyToAsync[AsyncStorage에 복사<br/>FCM_SERMON_KEY]
    CompareSig -->|아니오| LoadLocal3
    CopyToAsync --> UpdateSig[updateLastSyncedSignature]
    UpdateSig --> LoadLocal3
    LoadLocal3 --> End2([업데이트 완료])
```

### 3. iOS 주기적 체크 (5초마다)
```mermaid
flowchart TD
    Interval[5초마다 체크<br/>setInterval] --> CheckActive{앱이<br/>active?}
    CheckActive -->|아니오| Wait[대기]
    CheckActive -->|예| ReadAppGroup2[App Group에서<br/>displaySermon 읽기]
    ReadAppGroup2 --> HasData2{데이터<br/>있음?}
    HasData2 -->|예| Normalize2[normalizeJsonString]
    HasData2 -->|아니오| Wait
    Normalize2 --> CompareSig2{서명이<br/>변경됨?}
    CompareSig2 -->|예| CopyToAsync2[AsyncStorage에 복사]
    CompareSig2 -->|아니오| Wait
    CopyToAsync2 --> UpdateSig2[updateLastSyncedSignature]
    UpdateSig2 --> LoadLocal4[loadLocalData 호출]
    LoadLocal4 --> Wait
    Wait --> Interval
```

### 4. SettingsScreen에서 새로고침 버튼 클릭 시
```mermaid
flowchart TD
    RefreshBtn[데이터 새로고침 버튼 클릭] --> OnRefresh[onRefresh 호출]
    OnRefresh --> FetchServer2[fetchDataFromServer 호출]
    FetchServer2 --> QueryServer2[Firestore 서버 쿼리<br/>orderBy date desc, limit 1]
    QueryServer2 --> ServerEmpty2{서버에<br/>데이터 있음?}
    ServerEmpty2 -->|없음| End3([완료])
    ServerEmpty2 -->|있음| ConvertServer2[firestoreDocToSermon<br/>서버 데이터를 Sermon으로 변환]
    ConvertServer2 --> SetSermonServer2[setSermon latestSermon<br/>서버에서 가져온 최신 데이터로 업데이트]
    SetSermonServer2 --> End3
```

## 주요 함수 설명

### `loadLocalData()`
- **목적**: 로컬 저장소(Firestore 캐시, AsyncStorage)에서 최신 설교 데이터를 로드하고 비교하여 선택
- **반환**: 선택된 `Sermon | null`
- **로직**:
  1. Firestore 캐시에서 최신 설교 조회
  2. AsyncStorage에서 최신 설교 조회
  3. `compareSermon()`으로 두 데이터 비교 (date → updated_at 순서)
  4. 더 최신인 것을 선택하여 `setSermon()` 호출

### `fetchDataFromServer()`
- **목적**: Firestore 서버에서 최신 설교 데이터를 직접 가져옴
- **사용 시점**:
  - 앱 초기화 시 1주일 이상 오래된 데이터인 경우
  - SettingsScreen에서 새로고침 버튼 클릭 시
- **로직**:
  1. Firestore 서버에 쿼리 (date desc, limit 1)
  2. 결과를 `firestoreDocToSermon()`으로 변환
  3. `setSermon()` 호출

### `compareSermon(a, b)`
- **목적**: 두 Sermon 객체를 비교하여 어느 것이 더 최신인지 판단
- **반환**: 
  - `> 0`: a가 더 최신
  - `= 0`: 같음
  - `< 0`: b가 더 최신
- **비교 순서**:
  1. `date` 필드 비교 (문자열)
  2. `date`가 같으면 `updated_at` 필드 비교 (타임스탬프)

### `checkInvalidate(latestSermonDate)`
- **목적**: 선택된 설교 데이터가 1주일 이상 오래되었는지 확인
- **반환**: `boolean` (true면 서버에서 새로 가져와야 함)
- **로직**:
  - date가 null이면 true 반환
  - 현재 날짜 - 7일과 비교하여 오래되었으면 true 반환

## 데이터 소스 우선순위

1. **서버 데이터** (fetchDataFromServer)
   - SettingsScreen 새로고침 시
   - 앱 초기화 시 1주일 이상 오래된 경우

2. **로컬 데이터 비교 결과** (loadLocalData)
   - Firestore 캐시 vs AsyncStorage 중 더 최신인 것
   - FCM 이벤트 수신 시
   - 앱 포그라운드 복귀 시
   - iOS 주기적 체크 시

