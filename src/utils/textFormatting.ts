export const processTitleText = (title: string | undefined): string => {
  if (!title) return '';
  return title.replace(/^(\d+)\s+/, '$1\n').replace(/\(/g, '\n(');
};

const QT_DAY_OF_WEEK_KO: Record<string, string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일',
};

// Android QtWidgetUiModel.formatDateLabel(app/.../ui/widget/qt/QtWidgetUiModel.kt)과 동일한
// 규칙("M월 d일 · 요일") — QT 위젯 미리보기(EditScreen)가 실제 네이티브 QT 위젯과 같은 날짜
// 표기를 보여주기 위해 RN 쪽에도 같은 포맷을 둔다([ISSUE-236] 후속: QT 미리보기가 주일 말씀과
// 같은 레이아웃을 쓰던 문제 수정).
export const formatQtDateLabel = (date: string, dayOfWeek: string | undefined): string => {
  const day = dayOfWeek ? QT_DAY_OF_WEEK_KO[dayOfWeek.toUpperCase()] : undefined;
  if (!day) return '';
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return day;
  const month = parseInt(match[2], 10);
  const dayOfMonth = parseInt(match[3], 10);
  return `${month}월 ${dayOfMonth}일 · ${day}`;
};
