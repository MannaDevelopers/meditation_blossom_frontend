import { buildFullCopyText, buildPassageCopyText, buildQuestionsCopyText } from '../src/utils/copyText';

describe('buildPassageCopyText', () => {
  // 칩 옆 복사 버튼은 "그 구절"을 복사한다([#166]). 붙여넣었을 때 어느 장절인지
  // 알 수 있어야 쓸모가 있으므로 라벨을 함께 넣는다.
  it('장절 라벨과 본문을 함께 복사한다', () => {
    expect(
      buildPassageCopyText({
        label: '열왕기하 23:21-25',
        content: '21 왕이 뭇 백성에게 명령하여\n\n22 사사가 이스라엘을 다스리던',
        isWholeChapter: false,
      }),
    ).toBe('열왕기하 23:21-25\n21 왕이 뭇 백성에게 명령하여\n\n22 사사가 이스라엘을 다스리던');
  });
});

describe('buildQuestionsCopyText', () => {
  // 묵상 질문 섹션 복사 버튼([#300]) · 전체 복사(buildFullCopyText)가 공유하는 포맷.
  it('묵상 질문 헤더와 함께 불릿으로 나열한다', () => {
    expect(
      buildQuestionsCopyText([
        '오늘 내 자리에서 거룩은 무엇입니까?',
        '이 말씀을 삶에 어떻게 적용하겠습니까?',
      ]),
    ).toBe(
      '묵상 질문\n' +
        '- 오늘 내 자리에서 거룩은 무엇입니까?\n' +
        '- 이 말씀을 삶에 어떻게 적용하겠습니까?',
    );
  });

  it('빈 문자열/공백뿐인 질문은 제외한다', () => {
    expect(buildQuestionsCopyText(['질문 하나', '   ', ''])).toBe('묵상 질문\n- 질문 하나');
  });

  // 콘텐츠 작성자가 하위 질문에 이미 원문자 번호를 붙여둔 경우 "- ❶"처럼
  // 중복 표기되지 않도록, 번호가 있는 줄은 "- "를 붙이지 않는다.
  it('원문자 번호로 시작하는 줄에는 "-"를 붙이지 않는다', () => {
    expect(
      buildQuestionsCopyText([
        '고난 속에도 하나님께 순종하기를 선택하고 있습니까?',
        '❶ 고난을 통해 우리를 완성시키실 하나님을 신뢰합니까?',
        '❷ 고난을 통해 드러날 하나님의 역사를 기대하고 있습니까?',
      ]),
    ).toBe(
      '묵상 질문\n' +
        '- 고난 속에도 하나님께 순종하기를 선택하고 있습니까?\n' +
        '❶ 고난을 통해 우리를 완성시키실 하나님을 신뢰합니까?\n' +
        '❷ 고난을 통해 드러날 하나님의 역사를 기대하고 있습니까?',
    );
  });
});

describe('buildFullCopyText', () => {
  const passages = [
    { label: '열왕기하 22:2', content: '2 요시야가 여호와 보시기에', isWholeChapter: false },
    { label: '열왕기하 23:21-25', content: '21 왕이 뭇 백성에게', isWholeChapter: false },
  ];

  // 확정 복사 대상: 제목 + 장절 참조 + 본문 전체 + 묵상질문([#166])
  it('제목 · 참조별 본문 · 묵상질문을 순서대로 담는다', () => {
    expect(
      buildFullCopyText({
        title: '4. 개혁! 좌로나 우로 치우치지 않는 것',
        passages,
        questions: ['오늘 내 자리에서 거룩은 무엇입니까?'],
      }),
    ).toBe(
      '4. 개혁! 좌로나 우로 치우치지 않는 것\n\n' +
        '열왕기하 22:2\n2 요시야가 여호와 보시기에\n\n' +
        '열왕기하 23:21-25\n21 왕이 뭇 백성에게\n\n' +
        '묵상 질문\n- 오늘 내 자리에서 거룩은 무엇입니까?',
    );
  });
});
