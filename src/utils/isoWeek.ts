// sermons-v2 'week' 필드와 동일한 ISO 8601 week 계산(docs/firestore/sermons-v2.md 정의).
// SettingsScreen의 개발자 메뉴 모의 데이터 생성과 legacy 'sermons' 컬렉션(묵상 지우기 판단용
// ISO week 역산)이 같은 공식을 쓰므로 여기 하나로 모은다.
export function toIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' 문자열로부터 ISO 8601 week을 계산한다. 파싱 실패 시 null. */
export function isoWeekFromDateString(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return toIsoWeek(d);
}
