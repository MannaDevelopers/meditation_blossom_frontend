# Sermons

Firestore에 저장되는 설교 문서의 스키마 정의입니다.

## Collection

| Profile | Collection Name |
|---------|----------------|
| live    | `sermons`       |
| alpha   | `alpha-sermons` |

## Document Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `source_id` | `string` | | 원본 게시글 ID (manna.or.kr의 post ID) |
| `title` | `string` | | 설교 제목 |
| `category` | `string` | | 설교 카테고리 |
| `bible_references` | `array<map>` | | 성경 참조 목록 (아래 구조 참고) |
| `content` | `string` | | `"본문 : {참조}\n{본문}"` 형태의 조합 필드 (하위 호환용) |
| `raw_hash` | `string` | | 원본 텍스트의 SHA-256 해시 (변경 감지용) |
| `date` | `string` | | 설교 날짜 (`YYYY-MM-DD`) |
| `year` | `string` | | 설교 연도 (`YYYY`) |
| `day_of_week` | `string` | | 요일 (`MON`, `TUE`, ... `SUN`) |
| `video_url` | `string` | Y | 설교 영상 URL (YouTube 또는 Vimeo, 정규화된 형태) |
| `created_at` | `timestamp` | | 최초 저장 시각 (UTC) |
| `updated_at` | `timestamp` | | 마지막 수정 시각 (UTC) |

### bible_references 구조

```json
[
  {
    "book": "디모데전서",
    "chapter": 4,
    "verse_start": 7,
    "verse_end": 8,
    "verses": [
      { "verse_number": 7, "content": "망령되고 허탄한 신화를 버리고..." },
      { "verse_number": 8, "content": "육체의 연단은 약간의 유익이 있으나..." }
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
source_id          "199134"
title              "[주일설교] 부흥의 주인공 /김한요 목사"
category           "자유주제"
bible_references   [{"book": "요나", "chapter": 3, "verse_start": 1, "verse_end": 10, "verses": [...]}]
content            "본문 : 요나 3:1-10\n1 여호와의 말씀이 ..."
raw_hash           "ca118884f7bf162a..."
date               "2026-03-01"
year               "2026"
day_of_week        "SUN"
video_url          "https://www.youtube.com/watch?v=grlz1iciG-w"
created_at         March 1, 2026 at 12:00:00 PM UTC
updated_at         March 1, 2026 at 12:00:00 PM UTC
```
