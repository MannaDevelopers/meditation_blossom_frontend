import { fcmDataToSermon, firestoreDocToSermon } from '../src/types/Sermon';
import { fcmDataToQt } from '../src/types/QT';

jest.mock('../src/types/WidgetUpdateModule', () => null);
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// 참조 배열이 Sermon 객체에 남아 있어야 화면이 칩을 그릴 수 있다([#173]).
// 지금까지는 변환 과정에서 버려져 AsyncStorage 왕복 후 참조가 사라졌다.
describe('fcmDataToSermon', () => {
  it('bible_references를 보존한다', () => {
    const refs = JSON.stringify([
      { book: '열왕기하', chapter: 22, verse_start: 2, verse_end: 2 },
    ]);
    const sermon = fcmDataToSermon({
      id: 's1',
      title: '제목',
      content: '본문 : 열왕기하 22:2 2 요시야가',
      date: '2026-09-06',
      bible_references: refs,
    });
    expect(sermon.bible_references).toBe(refs);
  });
});

describe('firestoreDocToSermon', () => {
  // Firestore는 배열로 준다. 저장·복원이 FCM 경로와 같은 모양이 되도록 문자열로 맞춘다.
  it('배열로 온 bible_references를 JSON 문자열로 보존한다', async () => {
    const refs = [{ book: '열왕기하', chapter: 22, verse_start: 2, verse_end: 2 }];
    const doc = {
      id: 'd1',
      data: () => ({ title: 'T', date: '2026-09-06', bible_references: refs }),
    };
    const sermon = await firestoreDocToSermon(doc as never);
    expect(sermon.bible_references).toBe(JSON.stringify(refs));
  });

  it('참조가 없으면 undefined로 둔다', async () => {
    const doc = { id: 'd2', data: () => ({ title: 'T', date: '2026-09-06' }) };
    const sermon = await firestoreDocToSermon(doc as never);
    expect(sermon.bible_references).toBeUndefined();
  });
});

// 매일 만나도 같은 화면 구조를 쓰므로 QT에도 동일하게 필요하다.
describe('fcmDataToQt', () => {
  it('bible_references를 보존한다', () => {
    const refs = JSON.stringify([
      { book: '데살로니가전서', chapter: 5, verse_start: 16, verse_end: 18 },
    ]);
    const qt = fcmDataToQt({
      id: 'q1',
      title: '214 감사로 다시',
      series_title: '하나님의 손길',
      content: '본문 : 데살로니가전서 5:16-18 16 항상 기뻐하라',
      date: '2026-09-07',
      bible_references: refs,
    });
    expect(qt.bible_references).toBe(refs);
  });
});
