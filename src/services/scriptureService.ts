import { extractContent } from '../utils/sermonParser';
import {
  BibleRef,
  ChapterLastVerseLookup,
  formatReferenceLabel,
  isWholeChapter,
} from '../utils/scriptureLayout';

/** 화면이 참조 하나를 그리는 데 필요한 전부 */
export interface ScripturePassage {
  /** 칩·선택 탭 라벨. 예: "열왕기하 23:21-25" */
  label: string;
  /** 절들이 이어진 본문. 없으면 빈 문자열 */
  content: string;
  /** 페이지 모드 판정에 쓰는 "장 전체" 여부 */
  isWholeChapter: boolean;
}

/**
 * 네이티브 브릿지의 resolveBibleReferences와 같은 모양.
 * 주입해서 받는 이유는 테스트에서 네이티브 모듈을 흉내 내지 않기 위해서다.
 */
export type ReferenceResolver = (refsJson: string) => Promise<string>;

/**
 * 단일 절 참조의 절 번호를 채운다.
 *
 * Kotlin 리졸버는 절이 1개면 번호를 생략하고(BibleReferenceResolver.kt:61-65) Swift는 항상
 * 붙인다. 여러 참조를 합쳐 부르던 때는 절이 여러 개라 이 분기에 잘 안 걸렸는데, 참조당
 * 나눠 부르면서 단일 절 참조가 흔해져 플랫폼 차이가 드러났다. 화면이 기기마다 달라
 * 보이면 안 되므로 여기서 맞춘다.
 */
function ensureVerseNumber(content: string, ref: BibleRef): string {
  const isSingleVerse = (ref.verse_end ?? ref.verse_start) === ref.verse_start;
  if (!isSingleVerse || !content) return content;
  return content.startsWith(`${ref.verse_start} `) ? content : `${ref.verse_start} ${content}`;
}

/**
 * 참조 배열을 참조별 본문으로 쪼갠다([#173]).
 *
 * 브릿지는 여러 참조를 받으면 "본문 : {참조들} {절들}" 한 덩어리로 합쳐 돌려주기 때문에
 * RN 쪽에서 경계를 되찾을 방법이 없다. 대신 **참조 1개짜리 배열로 나눠 호출**하면
 * 애초에 분리된 결과가 나온다 — Kotlin(BibleReferenceResolver.kt:46)과
 * Swift(WidgetUpdateModule.swift:323) 모두 임의 길이 배열을 받으므로 네이티브 변경이 없다.
 *
 * 각 결과는 기존 extractContent를 그대로 통과시켜 파서를 새로 만들지 않는다.
 */
export async function resolvePassages(
  refs: BibleRef[],
  resolve: ReferenceResolver,
  lastVerseOf: ChapterLastVerseLookup,
): Promise<ScripturePassage[]> {
  return Promise.all(
    refs.map(async ref => {
      const raw = await resolve(JSON.stringify([ref]));
      return {
        label: formatReferenceLabel(ref),
        content: ensureVerseNumber(extractContent(raw).content, ref),
        isWholeChapter: isWholeChapter(ref, lastVerseOf),
      };
    }),
  );
}
