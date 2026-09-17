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

  // sermons-v2(week 있음): week_worship_type을 primary로 쓰고 secondary는 없다 — 애매한 경우가 없다.
  it('week가 있으면 week_worship_type을 primary로 쓰고 secondary는 없다', () => {
    const sermon = makeSermon({ week: '2026-W37', worship_type: 'SUN_0950' });
    expect(sermonNoteIdentity(sermon)).toEqual({ primary: '2026-W37_SUN_0950' });
  });

  // video_url만 채워지는 갱신은 week/worship_type/date가 그대로라 identity가 바뀌지 않는다.
  it('video_url만 바뀌어도 identity는 그대로다', () => {
    const before = makeSermon({ week: '2026-W37', worship_type: 'SUN_0950' });
    const after = makeSermon({
      week: '2026-W37',
      worship_type: 'SUN_0950',
      video_url: 'https://youtu.be/x',
    });
    expect(sermonNoteIdentity(before)).toEqual(sermonNoteIdentity(after));
  });

  // '전체' 옵션(레거시 'sermons', week 없음): date로부터 ISO week을 역산해 primary로, 문서 id를 secondary로.
  it('week가 없으면(전체 옵션) date로 ISO week을 역산하고 id를 secondary로 둔다', () => {
    const sermon = makeSermon({ id: 'legacy-doc-1', date: '2026-09-13', week: undefined });
    expect(sermonNoteIdentity(sermon)).toEqual({
      primary: isoWeekFromDateString('2026-09-13'),
      secondary: 'legacy-doc-1',
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

  it('date만 primary로 쓰고 secondary(배너)는 없다 — 새 QT는 무조건 자동 삭제', () => {
    expect(qtNoteIdentity(makeQt({ date: '2026-09-14' }))).toEqual({ primary: '2026-09-14' });
  });
});
