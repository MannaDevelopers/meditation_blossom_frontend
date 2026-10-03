import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WORSHIP_BOUNDARY_CHECK_INTERVAL_MS } from '../constants';
import { compareSermon, Sermon, WorshipSetting, USER_WORSHIP_SETTING_KEY, DEFAULT_WORSHIP_TYPE } from '../types/Sermon';
import {
  fetchLatestSermonFromAsyncStorage,
  fetchLatestSermonFromServer,
  mergeFreshWeeklyResults,
  saveSermonToAsyncStorage,
  subscribeToLatestSermon,
  fetchLatestWeeklySermonsFromAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  fetchLatestWeeklySermonsFromServer,
  pushSermonToWidget,
} from '../services/sermonService';
import { logAnalytics } from '../utils/analytics';
import { getEffectiveNow } from '../utils/devWorshipTimeOverride';
import logger from '../utils/logger';
import { reconcileFreshDoc } from '../utils/reconcileFreshDoc';
import { hasArrivedWeeklySermon, selectGatedWeeklySermon } from '../utils/worshipSchedule';

export interface UseSermonDataReturn {
  sermon: Sermon | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  loadLocalData: () => Promise<Sermon | null>;
  fetchFromServer: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function useSermonData(): UseSermonDataReturn {
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sermonRef = useRef<Sermon | null>(null);
  sermonRef.current = sermon;
  // video_url/content 보충용 서버 강제 조회를 세션당 1회로 제한 (영상이 원래 없는 설교에서 반복 조회 방지)
  const triedServerFill = useRef(false);

  const loadLocalData = useCallback(async (): Promise<Sermon | null> => {
    try {
      const worshipSetting = (await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipSetting || DEFAULT_WORSHIP_TYPE;
      let selected: Sermon | null = null;
      let candidateMissing = false;
      let localWeeklySermons: Sermon[] = [];
      if (worshipSetting !== 'ALL') {
        const weeklySermons = (await fetchLatestWeeklySermonsFromAsyncStorage()) || [];
        localWeeklySermons = weeklySermons;
        const previouslyDisplayed = await fetchLatestSermonFromAsyncStorage();
        const now = await getEffectiveNow();
        // 시각이 이미 지난 일치 항목이 캐시에 없으면(예: 이번 주 FCM만 받아둔 상태) 이 예배시간에서
        // 지금 보여줄 말씀을 캐시로는 알 수 없다 → 아래에서 서버로 지난주까지 보충한다([ISSUE-329]).
        candidateMissing = !hasArrivedWeeklySermon(weeklySermons, worshipSetting, now);
        // 같은 예배시간 항목 중 시각이 이미 지난 가장 최신 주 항목을 쓴다. 앱을 열 때마다 시각과
        // 무관하게 캐시를 바로 반영하던 것이 이 버그의 핵심 원인이었다([ISSUE-315]).
        selected = selectGatedWeeklySermon(weeklySermons, worshipSetting, previouslyDisplayed, now);
      }

      if (!selected) {
        // '전체' 설정이거나(레거시 경로, [#278]) 아무 후보도 없으면 레거시 단일 문서로 폴백
        selected = await fetchLatestSermonFromAsyncStorage();
      }

      logger.log('AsyncStorage sermon:', selected ? `${selected.date} (${selected.worship_type || 'legacy'})` : 'null');

      setSermon(selected);
      setError(null);

      // 특정 예배가 선택돼 있는데 weekly 캐시에 그 예배시간과 일치하는 문서가 전혀 없는 경우
      // (앱을 막 sermons-v2 버전으로 업데이트해서 아직 주간 데이터를 한 번도 받은 적 없는 사용자
      // 등, 시각 미도달로 게이팅된 것과는 다른 상황), 화면에 보이는 레거시 데이터는
      // video_url/content가 이미 다 차 있어도 실제로는 선택한 예배와 무관한(전체) 콘텐츠일 수
      // 있다. 이 경우 필드 유무와 무관하게 강제로 서버에서 주간 데이터를 가져와야 한다
      // (실사용자 리포트로 발견).
      const needsWeeklyRefill = worshipSetting !== 'ALL' && candidateMissing;

      // 로컬 데이터에 video_url/content가 비어 있거나(기존 사유) 위 마이그레이션 케이스면
      // Firestore에서 강제 조회해 보충한다.
      if (selected && (needsWeeklyRefill || !selected.video_url || !selected.content) && !triedServerFill.current) {
        triedServerFill.current = true;
        try {
          const freshWeekly = worshipSetting !== 'ALL' ? await fetchLatestWeeklySermonsFromServer() : [];
          if (freshWeekly && freshWeekly.length > 0) {
            // 서버 응답으로 캐시를 통째로 덮어쓰지 않는다([ISSUE-315]) — 서버가 아직 모르는
            // (또는 아직 Firestore에 반영 안 된) 다른 예배시간의 FCM 수신 콘텐츠가 사라진다
            // (실사용자 리포트로 발견). mergeFreshWeeklyResults로 이번에 받아온 예배시간만
            // 교체하고 나머지는 보존한다.
            const mergedWeekly = mergeFreshWeeklyResults(localWeeklySermons, freshWeekly);
            await saveWeeklySermonsToAsyncStorage(mergedWeekly);
            // 일치하는 문서가 없을 때 freshWeekly[0]을 그냥 보여주던 예전 폴백은 제거했다
            // ([ISSUE-315]) — 그 항목이 다른 예배시간의 아직 안 된 콘텐츠일 수 있어, 일치하지
            // 않는 것만으로 게이팅을 우회해 미도착 콘텐츠가 새치기되는 사고가 났다(실사용자
            // 리포트). selected는 이 블록에 들어오기 위한 조건(위 if)에서 이미 non-null임이
            // 보장되므로 selectGatedWeeklySermon도 항상 non-null을 반환하지만, TS 타입상 남는
            // null 가능성은 방어적으로 freshWeekly[0]로 폴백한다.
            const freshSelected = worshipSetting !== 'ALL'
              ? selectGatedWeeklySermon(mergedWeekly, worshipSetting, selected, await getEffectiveNow()) ?? freshWeekly[0]
              : freshWeekly[0];
            // 지난주 말씀이 새로 골라진 경우 date가 selected(예: 옵션 전환 직전에 보던 다른
            // 예배의 이번 주 말씀)보다 오래돼 reconcileFreshDoc의 "더 최신만 교체" 규칙에 걸려
            // 버려진다([ISSUE-329]). 이 예배시간의 올바른 항목이 달라졌다면 date와 무관하게 교체한다.
            const isDifferentWeeklyEntry =
              freshSelected.worship_type === worshipSetting &&
              (selected.worship_type !== worshipSetting || selected.week !== freshSelected.week);
            const next = isDifferentWeeklyEntry
              ? freshSelected
              : reconcileFreshDoc(freshSelected, selected, compareSermon);
            if (next) {
              logger.log(needsWeeklyRefill
                ? '[loadLocalData] 선택된 예배의 weekly 캐시 미스(마이그레이션) → 서버에서 교체함'
                : '[loadLocalData] 로컬 video_url/content 누락 → 서버에서 보충함');
              await saveSermonToAsyncStorage(next);
              setSermon(next);
              return next;
            }
          } else {
            // Legacy fallback
            const fresh = await fetchLatestSermonFromServer();
            const next = fresh ? reconcileFreshDoc(fresh, selected, compareSermon) : null;
            if (next) {
              await saveSermonToAsyncStorage(next);
              setSermon(next);
              return next;
            }
          }
        } catch (fillErr) {
          logger.warn('useSermonData: 서버 보충 조회 실패 (offline?)', fillErr);
        }
      }

      return selected;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to load local data:', e);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFromServer = useCallback(async () => {
    logger.log('[SermonData] fetchFromServer: start');
    setIsLoading(true);
    setError(null);
    try {
      const worshipSetting = (await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipSetting || DEFAULT_WORSHIP_TYPE;
      const weeklyResults = worshipSetting !== 'ALL' ? (await fetchLatestWeeklySermonsFromServer()) || [] : [];
      logger.log('[SermonData] fetchFromServer: result count=' + weeklyResults.length);
      if (weeklyResults.length > 0) {
        // 캐시를 통째로 덮어쓰지 않고 병합한다([ISSUE-329]) — 서버가 최근 주만 돌려주므로 덮어쓰면
        // FCM으로만 받아둔 항목이 사라진다.
        const mergedWeekly = mergeFreshWeeklyResults(await fetchLatestWeeklySermonsFromAsyncStorage(), weeklyResults);
        await saveWeeklySermonsToAsyncStorage(mergedWeekly);
        // 일치하는 문서가 없을 때 weeklyResults[0]을 그냥 보여주던 예전 폴백은 제거했다
        // ([ISSUE-315]) — 다른 예배시간의 아직 안 된 콘텐츠가 새치기될 수 있어서다(실사용자
        // 리포트: 설정을 이리저리 바꾸는 것만으로 게이팅이 우회됨). 일치하는 문서가 없으면
        // sermonRef.current(이미 보여주던 콘텐츠, 없으면 null)를 그대로 쓴다 — 수동
        // 새로고침이라고 해서 게이팅을 건너뛰면 안 된다.
        const matched = worshipSetting !== 'ALL'
          ? selectGatedWeeklySermon(mergedWeekly, worshipSetting, sermonRef.current, await getEffectiveNow()) ?? weeklyResults[0]
          : weeklyResults[0];

        await saveSermonToAsyncStorage(matched);
        await pushSermonToWidget(matched);
        setSermon(matched);
        logger.log('[SermonData] fetchFromServer: setSermon called with worship_type=' + matched.worship_type);
      } else {
        // '전체' 설정이거나([#278]) 주간 데이터가 없으면 레거시 단일 조회로 폴백
        const result = await fetchLatestSermonFromServer();
        if (result) {
          await saveSermonToAsyncStorage(result);
          await pushSermonToWidget(result);
          setSermon(result);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('Failed to fetch from server:', e);
      setError(message);
      logAnalytics.dataLoadFailed('sermon');
    } finally {
      setIsLoading(false);
      logger.log('[SermonData] fetchFromServer: done, isLoading=false');
    }
  }, []);

  useEffect(() => {
    return subscribeToLatestSermon(
      async (fresh) => {
        if (compareSermon(fresh, sermonRef.current) > 0) {
          logger.log('onSnapshot: newer sermon received, updating weekly cache');
          try {
            const worshipSetting = (await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipSetting || DEFAULT_WORSHIP_TYPE;
            const weeklySermons = worshipSetting !== 'ALL' ? await fetchLatestWeeklySermonsFromServer() : [];
            if (weeklySermons.length > 0) {
              const mergedWeekly = mergeFreshWeeklyResults(await fetchLatestWeeklySermonsFromAsyncStorage(), weeklySermons);
              await saveWeeklySermonsToAsyncStorage(mergedWeekly);
              // 일치하는 문서가 없을 때 weeklySermons[0]을 그냥 보여주던 예전 폴백은 제거했다
              // ([ISSUE-315], 위 fetchFromServer와 동일한 이유).
              const matched = worshipSetting !== 'ALL'
                ? selectGatedWeeklySermon(mergedWeekly, worshipSetting, sermonRef.current, await getEffectiveNow()) ?? weeklySermons[0]
                : weeklySermons[0];
              await saveSermonToAsyncStorage(matched);
              await pushSermonToWidget(matched);
              setSermon(matched);
            } else {
              // '전체' 설정이거나([#278]) 주간 데이터가 없으면 스냅샷으로 받은 레거시 문서를 그대로 사용
              await saveSermonToAsyncStorage(fresh);
              await pushSermonToWidget(fresh);
              setSermon(fresh);
            }
          } catch (err) {
            logger.error('Failed to sync weekly sermons in subscription:', err);
            await saveSermonToAsyncStorage(fresh);
            await pushSermonToWidget(fresh);
            setSermon(fresh);
          }
        }
      },
      (e) => logger.error('Firestore subscription error:', e),
    );
  }, []);

  // 특정 예배시간 설정 중, 앱을 켜둔 채로 예배 시각 경계를 넘기면 새 FCM 없이도 자동으로
  // 반영되도록 주기적으로 재확인한다([ISSUE-315]). 이미 캐시된 weekly_sermons만 다시 보므로
  // 네트워크 호출은 없다.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const worshipSetting = (await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipSetting || DEFAULT_WORSHIP_TYPE;
        if (worshipSetting === 'ALL') return;
        const weekly = await fetchLatestWeeklySermonsFromAsyncStorage();
        const gated = selectGatedWeeklySermon(weekly, worshipSetting, sermonRef.current, await getEffectiveNow());
        if (gated && compareSermon(gated, sermonRef.current) > 0) {
          logger.log('[SermonData] 예배시간 경계 도달 감지 → 화면/위젯 갱신');
          await saveSermonToAsyncStorage(gated);
          await pushSermonToWidget(gated);
          setSermon(gated);
        }
      } catch (e) {
        logger.warn('useSermonData: 예배시간 경계 재확인 실패', e);
      }
    }, WORSHIP_BOUNDARY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchFromServer();
  }, [fetchFromServer]);

  return { sermon, isLoading, setIsLoading, error, loadLocalData, fetchFromServer, onRefresh };
}
