# QT

Firestore에 저장되는 QT 문서의 스키마 정의입니다.

## Collection

| Profile | Collection Name |
|---------|----------------|
| live    | `qt`            |
| alpha   | `alpha-qt`      |

## Document Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `source_id` | `string` | | 원본 게시글 ID |
| `title` | `string` | | QT 제목 |
| `series_title` | `string` | | QT 시리즈 제목 |
| `bible_references` | `array<map>` | | 성경 참조 목록 (아래 구조 참고) |
| `meditation_questions` | `array<string>` | | 묵상 질문 목록 |
| `raw_hash` | `string` | | 원본 텍스트의 SHA-256 해시 (변경 감지용) |
| `date` | `string` | | QT 날짜 (`YYYY-MM-DD`) |
| `year` | `string` | | QT 연도 (`YYYY`) |
| `day_of_week` | `string` | | 요일 (`MON`, `TUE`, ... `SUN`) |
| `video_url` | `string` | Y | 영상 URL |
| `created_at` | `timestamp` | | 최초 저장 시각 (UTC) |
| `updated_at` | `timestamp` | | 마지막 수정 시각 (UTC) |

### `bible_references` 구조

```json
[
  {
    "book": "에베소서",
    "chapter": 5,
    "verse_start": 15,
    "verse_end": 16,
    "verses": [
      { "verse_number": 15, "content": "그런즉 너희가 어떻게 행할지를 자세히 주의하여..." },
      { "verse_number": 16, "content": "세월을 아끼라 때가 악하니라" }
    ]
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `book` | `string` | 성경 책 이름 (개역개정판 정식 명칭) |
| `chapter` | `number` | 장 번호 |
| `verse_start` | `number` | 시작 절 번호 |
| `verse_end` | `number` | 끝 절 번호 (단일 절이면 verse_start와 동일) |
| `verses` | `array<map>` | 절 목록 |
| `verses[].verse_number` | `number` | 절 번호 |
| `verses[].content` | `string` | 절 내용 |

## Example

```
source_id              "200001"
title                  "[QT] 빛의 자녀로 살라"
series_title           "하나님의 손길"
bible_references       [{"book": "에베소서", "chapter": 5, "verse_start": 15, "verse_end": 16, "verses": [...]}]
meditation_questions   ["오늘 말씀에서 가장 마음에 와닿는 구절은?", "..."]
raw_hash               "ab12cd34ef56..."
date                   "2026-03-07"
year                   "2026"
day_of_week            "SAT"
video_url              null
created_at             March 7, 2026 at 12:00:00 PM UTC
updated_at             March 7, 2026 at 12:00:00 PM UTC
```
