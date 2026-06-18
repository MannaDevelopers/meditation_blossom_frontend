import { reconcileFreshDoc } from '../src/utils/reconcileFreshDoc';

type Doc = {
  date: string;
  content: string;
  video_url?: string;
  updated_at: { seconds: number; nanoseconds: number };
};

// date → updated_at 순으로 비교하는 테스트용 compare (compareSermon/compareQt와 동일 규칙)
function compare(a: Doc | null, b: Doc | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (a.date > b.date) return 1;
  if (a.date < b.date) return -1;
  const at = a.updated_at.seconds;
  const bt = b.updated_at.seconds;
  return at > bt ? 1 : at < bt ? -1 : 0;
}

const make = (over: Partial<Doc>): Doc => ({
  date: '2026-06-13',
  content: '본문 내용',
  updated_at: { seconds: 1000, nanoseconds: 0 },
  ...over,
});

describe('reconcileFreshDoc', () => {
  it('current가 null이면 fresh를 채택', () => {
    const fresh = make({});
    expect(reconcileFreshDoc(fresh, null, compare)).toBe(fresh);
  });

  it('fresh가 더 최신(날짜)이면 통째 교체', () => {
    const current = make({ date: '2026-06-06' });
    const fresh = make({ date: '2026-06-13' });
    expect(reconcileFreshDoc(fresh, current, compare)).toBe(fresh);
  });

  it('fresh가 더 오래되면(날짜) null', () => {
    const current = make({ date: '2026-06-13' });
    const fresh = make({ date: '2026-06-06' });
    expect(reconcileFreshDoc(fresh, current, compare)).toBeNull();
  });

  // 핵심 버그 케이스: 같은 날짜인데 로컬에 video_url이 없고 서버에 있을 때 보충
  it('같은 날짜 + 로컬 video_url 없음 + 서버 있음 → video_url 보충', () => {
    const current = make({ video_url: undefined });
    const fresh = make({ video_url: 'https://youtu.be/abc' });
    const result = reconcileFreshDoc(fresh, current, compare);
    expect(result).not.toBeNull();
    expect(result!.video_url).toBe('https://youtu.be/abc');
  });

  it('같은 날짜 + 로컬 content 없음 + 서버 있음 → content 보충', () => {
    const current = make({ content: '' });
    const fresh = make({ content: '본문 내용' });
    const result = reconcileFreshDoc(fresh, current, compare);
    expect(result).not.toBeNull();
    expect(result!.content).toBe('본문 내용');
  });

  it('같은 날짜 + 로컬에 이미 video_url 있으면 서버 값으로 덮지 않음(머지, 기존 보존)', () => {
    const current = make({ video_url: 'https://youtu.be/local', content: '' });
    const fresh = make({ video_url: 'https://youtu.be/server', content: '본문 내용' });
    const result = reconcileFreshDoc(fresh, current, compare);
    expect(result).not.toBeNull();
    expect(result!.video_url).toBe('https://youtu.be/local'); // 기존 값 유지
    expect(result!.content).toBe('본문 내용'); // 빈 칸만 보충
  });

  // 영상이 원래 없는 항목: 서버에도 없으면 갱신하지 않음 → 불필요한 업데이트/루프 방지
  it('같은 날짜 + 양쪽 다 video_url 없음 → null (불필요한 갱신 없음)', () => {
    const current = make({ video_url: undefined });
    const fresh = make({ video_url: undefined });
    expect(reconcileFreshDoc(fresh, current, compare)).toBeNull();
  });

  it('같은 날짜 + 로컬에 content/video_url 모두 채워져 있으면 null', () => {
    const current = make({ content: '본문 내용', video_url: 'https://youtu.be/x' });
    const fresh = make({ content: '다른 본문', video_url: 'https://youtu.be/y' });
    expect(reconcileFreshDoc(fresh, current, compare)).toBeNull();
  });
});
