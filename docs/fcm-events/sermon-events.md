# Sermon Events

설교가 생성/수정될 때 FCM을 통해 발송되는 이벤트 데이터 스키마입니다. 모든 값은 `string` 타입으로 전달됩니다.

## 버전 히스토리

- **v1** (`sermon_events`): 설교 본문을 `content` 필드(`"본문 : {참조}\n{본문}"` 형태의 평문)로 전달합니다.
- **v2** (`sermon_events_v2`): 본문 표현을 구조화된 `bible_references`(JSON 배열 문자열)로 변경합니다.

`content`와 `bible_references`를 합치면 약 5KB로, FCM Android data payload 4KB 제한을 초과합니다.
각각 단독 전송 시에만 제한 이내에 들어오므로 v2는 별도 토픽으로 발행합니다.

---

## v1: sermon_events

기존 클라이언트 호환용. 본문을 `content` 평문으로 전달합니다.

### Topic

| Profile | Topic Name |
|---------|------------|
| live    | `sermon_events`       |
| alpha   | `alpha_sermon_events` |

### Data Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `source_id` | `string` | | 원본 게시글 ID |
| `title` | `string` | | 설교 제목 |
| `category` | `string` | | 설교 카테고리 |
| `content` | `string` | | `"본문 : {참조}\n{본문}"` 형태의 조합 필드 |
| `date` | `string` | | 설교 날짜 (`YYYY-MM-DD`) |
| `year` | `string` | | 설교 연도 (`YYYY`) |
| `day_of_week` | `string` | | 요일 (`MON` ~ `SUN`) |
| `video_url` | `string` | Y | 설교 영상 URL (없으면 필드 자체가 제외됨) |
| `created_at` | `string` | | 최초 저장 시각 (ISO 8601, UTC) |
| `updated_at` | `string` | | 마지막 수정 시각 (ISO 8601, UTC) |
| `operation` | `string` | | 이벤트 유형 (`CREATED` \| `UPDATED`) |
| `topic` | `string` | | FCM 토픽명 |

### Example

```json
{
  "source_id": "199134",
  "title": "[주일설교] 부흥의 주인공 /김한요 목사",
  "category": "자유주제",
  "content": "본문 : 요나 3:1-10\n1 여호와의 말씀이 ...",
  "date": "2026-03-01",
  "year": "2026",
  "day_of_week": "SUN",
  "video_url": "https://www.youtube.com/watch?v=grlz1iciG-w",
  "created_at": "2026-03-01T12:00:00+00:00",
  "updated_at": "2026-03-01T12:00:00+00:00",
  "operation": "CREATED",
  "topic": "sermon_events"
}
```

---

## v2: sermon_events_v2

본문 표현을 `bible_references`로 구조화하여 전달합니다.
`bible_references`의 상세 스키마는 [Firestore sermons 문서](../firestore/sermons.md#bible_references-구조)를 참고하세요.

### Topic

| Profile | Topic Name |
|---------|------------|
| live    | `sermon_events_v2`       |
| alpha   | `alpha_sermon_events_v2` |

### Data Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `source_id` | `string` | | 원본 게시글 ID |
| `title` | `string` | | 설교 제목 |
| `category` | `string` | | 설교 카테고리 |
| `bible_references` | `string` | | 성경 참조 목록 (JSON 배열 문자열, 스키마는 [sermons 문서](../firestore/sermons.md#bible_references-구조) 참고) |
| `date` | `string` | | 설교 날짜 (`YYYY-MM-DD`) |
| `year` | `string` | | 설교 연도 (`YYYY`) |
| `day_of_week` | `string` | | 요일 (`MON` ~ `SUN`) |
| `video_url` | `string` | Y | 설교 영상 URL (없으면 필드 자체가 제외됨) |
| `created_at` | `string` | | 최초 저장 시각 (ISO 8601, UTC) |
| `updated_at` | `string` | | 마지막 수정 시각 (ISO 8601, UTC) |
| `operation` | `string` | | 이벤트 유형 (`CREATED` \| `UPDATED`) |
| `topic` | `string` | | FCM 토픽명 |

### Example

```json
{
  "source_id": "199134",
  "title": "[주일설교] 부흥의 주인공 /김한요 목사",
  "category": "자유주제",
  "bible_references": "[{\"book\": \"요나\", \"chapter\": 3, \"verse_start\": 1, \"verse_end\": 10, \"verses\": [...]}]",
  "date": "2026-03-01",
  "year": "2026",
  "day_of_week": "SUN",
  "video_url": "https://www.youtube.com/watch?v=grlz1iciG-w",
  "created_at": "2026-03-01T12:00:00+00:00",
  "updated_at": "2026-03-01T12:00:00+00:00",
  "operation": "CREATED",
  "topic": "sermon_events_v2"
}
```

---

> `video_url`이 없는 경우 해당 필드는 payload에 포함되지 않습니다.
> `bible_references`는 FCM data payload 제약으로 JSON 문자열로 직렬화되어 전달됩니다.
