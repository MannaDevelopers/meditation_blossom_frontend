import { useEffect, useState } from 'react';
import { resolvePassages, ScripturePassage } from '../services/scriptureService';
import WidgetUpdateModule from '../types/WidgetUpdateModule';
import { chapterLastVerse, decideScriptureMode, ScriptureMode } from '../utils/scriptureLayout';
import { extractContent } from '../utils/sermonParser';
import logger from '../utils/logger';

export interface ScriptureView {
  passages: ScripturePassage[];
  mode: ScriptureMode;
}

/**
 * 말씀 본문을 참조별 블록으로 쪼갠다([#173]).
 *
 * 구 캐시 대응: AsyncStorage에 bible_references 없이 저장된 사용자가 있다. 그 경우
 * 참조별로 쪼갤 방법이 없으므로 기존 렌더링(장절 한 줄 + 본문 한 덩어리)을 그대로 유지한다.
 * 화면이 비지 않는 것이 참조를 나누는 것보다 우선이다.
 */
export function useScripturePassages(
  bibleReferences: string | undefined,
  content: string | undefined,
): ScriptureView {
  const [view, setView] = useState<ScriptureView>({ passages: [], mode: 'inline' });

  useEffect(() => {
    let cancelled = false;

    const fallback = (): ScriptureView => {
      if (!content) return { passages: [], mode: 'inline' };
      const parsed = extractContent(content);
      return {
        passages: [{ label: parsed.index, content: parsed.content, isWholeChapter: false }],
        mode: 'inline',
      };
    };

    const resolver = WidgetUpdateModule?.resolveBibleReferences;
    if (!bibleReferences || !resolver) {
      setView(fallback());
      return;
    }

    let refs;
    try {
      refs = JSON.parse(bibleReferences);
    } catch (e) {
      logger.error('useScripturePassages: bible_references 파싱 실패', e);
      setView(fallback());
      return;
    }
    if (!Array.isArray(refs) || refs.length === 0) {
      setView(fallback());
      return;
    }

    resolvePassages(refs, r => resolver(r), chapterLastVerse)
      .then(passages => {
        if (cancelled) return;
        // 본문을 하나도 못 얻으면 참조별로 쪼갠 의미가 없다. 기존 렌더링으로 되돌린다.
        if (passages.every(p => !p.content)) {
          setView(fallback());
          return;
        }
        setView({ passages, mode: decideScriptureMode(refs, chapterLastVerse) });
      })
      .catch(e => {
        if (cancelled) return;
        logger.error('useScripturePassages: 참조별 본문 조회 실패', e);
        setView(fallback());
      });

    return () => {
      cancelled = true;
    };
  }, [bibleReferences, content]);

  return view;
}
