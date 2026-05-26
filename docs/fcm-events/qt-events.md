# QT Events

QT가 생성/수정될 때 FCM을 통해 발송되는 이벤트 데이터 스키마입니다. 모든 값은 `string` 타입으로 전달됩니다.

## Topic

| Profile | Topic Name |
|---------|------------|
| live    | `qt_events`       |
| alpha   | `alpha_qt_events` |

## Data Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `source_id` | `string` | | 원본 게시글 ID |
| `title` | `string` | | QT 제목 |
| `series_title` | `string` | | QT 시리즈 제목 |
| `bible_references` | `string` | | 성경 참조 목록 (JSON 배열 문자열) |
| `meditation_questions` | `string` | | 묵상 질문 목록 (JSON 배열 문자열) |
| `date` | `string` | | QT 날짜 (`YYYY-MM-DD`) |
| `year` | `string` | | QT 연도 (`YYYY`) |
| `day_of_week` | `string` | | 요일 (`MON` ~ `SUN`) |
| `video_url` | `string` | Y | 영상 URL (없으면 필드 자체가 제외됨) |
| `created_at` | `string` | | 최초 저장 시각 (ISO 8601, UTC) |
| `updated_at` | `string` | | 마지막 수정 시각 (ISO 8601, UTC) |
| `operation` | `string` | | 이벤트 유형 (`CREATED` \| `UPDATED`) |
| `topic` | `string` | | FCM 토픽명 |

## Example: CREATED Event

```json
{
  "source_id": "200001",
  "title": "[QT] 빛의 자녀로 살라",
  "series_title": "하나님의 손길",
  "bible_references": "[{\"book\": \"에베소서\", \"chapter\": 5, \"verse_start\": 15, \"verse_end\": 16, \"verses\": [...]}]",
  "meditation_questions": "[\"오늘 말씀에서 가장 마음에 와닿는 구절은?\", \"...\"]",
  "date": "2026-03-07",
  "year": "2026",
  "day_of_week": "SAT",
  "created_at": "2026-03-07T12:00:00+00:00",
  "updated_at": "2026-03-07T12:00:00+00:00",
  "operation": "CREATED",
  "topic": "qt_events"
}
```

> `video_url`이 없는 경우 해당 필드는 payload에 포함되지 않습니다.
> `bible_references`, `meditation_questions`는 FCM data payload 제약으로 JSON 문자열로 직렬화되어 전달됩니다.
