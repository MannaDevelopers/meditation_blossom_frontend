import { Sermon } from '../src/types/Sermon';
import { QT } from '../src/types/QT';
import { sermonNoteIdentity, qtNoteIdentity } from '../src/utils/meditationNoteIdentity';
import { isoWeekFromDateString } from '../src/utils/isoWeek';

const TIMESTAMP = { seconds: 0, nanoseconds: 0 };

function makeSermon(overrides: Partial<Sermon>): Sermon {
  return {
    id: 'doc-1',
    title: '제목',
    content: '내용',
    date: '2026-09-13',
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

describe('sermonNoteIdentity', () => {
  it('sermon이 없으면 null', () => {
    expect(sermonNoteIdentity(null)).toBeNull();
  });

  // sermons-v2(week 있음): week만 primary로 쓰고, mismatch 시엔 배너로 확인한다.
  it('week가 있으면 그대로 primary로 쓴다', () => {
    const sermon = makeSermon({ week: '2026-W37', worship_type: 'SUN_0950' });
    expect(sermonNoteIdentity(sermon)).toEqual({ primary: '2026-W37', onMismatch: 'confirm_clear' });
  });

  // 설정 화면에서 예배시간만 바꿔도(worship_type 변경) week가 같으면 identity가 그대로다 —
  // 이게 바뀌면 "설정만 바꿨는데 묵상이 지워지는" 회귀가 재현된다.
  it('worship_type만 달라도(예배시간 설정 변경) week가 같으면 identity는 그대로다', () => {
    const sunMorning = makeSermon({ week: '2026-W37', worship_type: 'SUN_0950' });
    const satEvening = makeSermon({ week: '2026-W37', worship_type: 'SAT_1700' });
    expect(sermonNoteIdentity(sunMorning)).toEqual(sermonNoteIdentity(satEvening));
  });

  // video_url만 채워지는 갱신은 week가 그대로라 identity가 바뀌지 않는다.
  it('video_url만 바뀌어도 identity는 그대로다', () => {
    const before = makeSermon({ week: '2026-W37' });
    const after = makeSermon({ week: '2026-W37', video_url: 'https://youtu.be/x' });
    expect(sermonNoteIdentity(before)).toEqual(sermonNoteIdentity(after));
  });

  // '전체' 옵션(레거시 'sermons', week 없음): date로부터 ISO week을 역산한다.
  it('week가 없으면(전체 옵션) date로 ISO week을 역산한다', () => {
    const sermon = makeSermon({ date: '2026-09-13', week: undefined });
    expect(sermonNoteIdentity(sermon)).toEqual({
      primary: isoWeekFromDateString('2026-09-13'),
      onMismatch: 'confirm_clear',
    });
  });

  it('전체 옵션에서 date를 파싱할 수 없으면 null', () => {
    const sermon = makeSermon({ date: 'invalid', week: undefined });
    expect(sermonNoteIdentity(sermon)).toBeNull();
  });
});

describe('qtNoteIdentity', () => {
  function makeQt(overrides: Partial<QT>): QT {
    return {
      id: 'qt-1',
      title: '제목',
      series_title: '시리즈',
      content: '내용',
      date: '2026-09-14',
      created_at: TIMESTAMP,
      updated_at: TIMESTAMP,
      ...overrides,
    };
  }

  it('qt가 없으면 null', () => {
    expect(qtNoteIdentity(null)).toBeNull();
  });

  it('date를 primary로 쓰고 mismatch 시 바로 지운다(auto_clear)', () => {
    expect(qtNoteIdentity(makeQt({ date: '2026-09-14' }))).toEqual({
      primary: '2026-09-14',
      onMismatch: 'auto_clear',
    });
  });
});
