import { useCallback, useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_GROUP_DISPLAY_SERMON_KEY } from '../constants';
import {
  readAppGroupData,
  syncAppGroupToAsyncStorage,
  fetchLatestSermonFromServer,
  fetchLatestWeeklySermonsFromServer,
  saveLegacySermonToCache,
  saveSermonToAsyncStorage,
  saveWeeklySermonsToAsyncStorage,
  sermonFromLegacyEvent,
  syncSelectedSermonToWidget,
  pushSermonToWidget,
  upsertWeeklySermonFromEvent,
} from '../services/sermonService';
import { SermonRaw, WorshipSetting, USER_WORSHIP_SETTING_KEY, DEFAULT_WORSHIP_TYPE } from '../types/Sermon';
import logger from '../utils/logger';

// 네이티브(Android NativeEventModule / iOS MyEventModule)는 sermons-v2와 레거시
// sermon_events(_v2) 모두 원본 FCM data를 params로 실어 보낸다. 정말 payload가 없는
// wake-up만 params 없이(undefined) 온다.
type SermonUpdateEvent = Partial<SermonRaw> & { operation?: string };

export function useFCMListener(onUpdate: () => void | Promise<unknown>): void {
  const onEventReceived = useCallback(async (event?: SermonUpdateEvent) => {
    logger.log(`${Platform.OS} FCM sermon update received`);
    // iOS: AppDelegate이 App Group에 올바르게 저장했으므로,
    // AsyncStorage(JS)에 동기화한 뒤 loadLocalData를 호출해 즉시 최신 데이터를 표시
    if (Platform.OS === 'ios') {
      try {
        const appGroupData = await readAppGroupData(APP_GROUP_DISPLAY_SERMON_KEY);
        if (appGroupData) {
          await syncAppGroupToAsyncStorage(appGroupData, null);
        }
      } catch (e) {
        logger.warn('useFCMListener: App Group displaySermon이 유효한 JSON이 아님, 건너뜀');
      }
    }

    try {
      const worshipSetting =
        ((await AsyncStorage.getItem(USER_WORSHIP_SETTING_KEY)) as WorshipSetting) || DEFAULT_WORSHIP_TYPE;
      const isWeeklyEvent = Boolean(event?.week && event?.worship_type);
      // sermon_events/sermon_events_v2(레거시, week/worship_type 없음) payload는 그 자체로
      // 화면에 필요한 내용을 다 담고 있다(docs/fcm-events/sermon-events.md) — Firestore를
      // 다시 조회하지 않고 바로 반영할 수 있다. title/date조차 없는 진짜 빈 wake-up만
      // 걸러내 아래에서 안전하게 폴백한다.
      const isLegacySermonEvent = !isWeeklyEvent && Boolean(event?.title && event?.date);

      // sermons-v2 단일 문서 이벤트는 '전체' 옵션이어도 weekly_sermons 캐시에 patch해둔다.
      // 예전엔 '전체'일 때 이 이벤트를 통째로 무시했는데, 그러면 나중에 특정 예배시간으로
      // 설정을 바꿨을 때 캐시가 그 사이 온 FCM을 못 받아 오래된 말씀이 그대로 보였다
      // (실사용자 리포트로 발견). 화면 표시(아래 분기)는 그대로 '전체'면 레거시 경로를
      // 쓰고, 캐시 patch만 항상 해둔다.
      const patched = isWeeklyEvent
        ? await upsertWeeklySermonFromEvent(event as SermonRaw)
        : null;
      // '전체'가 아니어도 레거시 이벤트는 미리 변환해 legacy 전용 캐시에 남겨둔다 —
      // FCM_SERMON_KEY에 저장하면 안 된다. 그 키는 예배시간 설정에 따라 sermons-v2
      // 문서로도 덮어써지는 "지금 화면" 슬롯이라, 나중에 '전체'로 돌아왔을 때 마지막에
      // 봤던 특정 예배의 sermons-v2 내용을 legacy 내용으로 착각하는 사고가 났다
      // (실사용자 리포트). legacy 전용 캐시([[LEGACY_SERMON_CACHE_KEY]])에 남겨두면
      // Firestore가 아직 갱신 전이어도(테스트 등) '전체'로 돌아왔을 때 방금 받은 최신
      // 내용이 바로 보인다([#302]와 동일한 이유 — weekly 캐시를 항상 patch해두는 것과 대칭).
      const legacyFromPayload = isLegacySermonEvent
        ? await sermonFromLegacyEvent(event as SermonRaw)
        : null;

      if (worshipSetting === 'ALL') {
        if (isWeeklyEvent) {
          // sermons-v2 이벤트는 '전체' 화면과 무관하다 — '전체'는 sermon_events(_v2)가
          // 왔을 때만 갱신돼야 한다(기획 확정). weekly 캐시는 위에서 이미 patch했으니
          // 여기서는 Firestore를 다시 읽거나 화면/위젯을 건드리지 않는다.
        } else {
          // 전체 옵션 화면 표시: payload가 온전하면 Firestore 재조회 없이 바로 반영한다
          // (포그라운드/백그라운드 모두 이 경로를 탄다 — 종료 상태는 네이티브가 App
          // Group/네이티브 위젯 저장소에 직접 써서 JS와 무관하게 이미 처리됨). payload가
          // 부족한 wake-up만 예전처럼 Firestore를 다시 읽어 안전하게 폴백한다.
          const legacy = legacyFromPayload ?? (await fetchLatestSermonFromServer());
          if (legacy) {
            await saveSermonToAsyncStorage(legacy);
            await saveLegacySermonToCache(legacy);
            await pushSermonToWidget(legacy);
          }
        }
      } else if (isWeeklyEvent) {
        // sermons-v2 단일 문서 이벤트: 전체 재조회 없이 위에서 patch한 결과만 반영([#280])
        if (patched && patched.worship_type === worshipSetting) {
          await saveSermonToAsyncStorage(patched);
          await pushSermonToWidget(patched);
        }
      } else if (legacyFromPayload) {
        // 지금 화면(특정 예배시간)과는 무관한 내용이라 FCM_SERMON_KEY/위젯은 건드리지
        // 않고 legacy 전용 캐시만 최신화한다.
        await saveLegacySermonToCache(legacyFromPayload);
      } else {
        // 정말 payload가 없는 wake-up(레거시 토픽 등) → 폴백으로 전체 재조회
        const weekly = await fetchLatestWeeklySermonsFromServer();
        if (weekly && weekly.length > 0) {
          await saveWeeklySermonsToAsyncStorage(weekly);
          await syncSelectedSermonToWidget(worshipSetting);
        }
      }
    } catch (e) {
      logger.error('useFCMListener: Failed to sync sermon data on FCM update', e);
    }

    await onUpdate();
  }, [onUpdate]);

  useEffect(() => {
    const { MyEventModule } = NativeModules;

    if (!MyEventModule) {
      logger.log('MyEventModule not available');
      return;
    }

    const eventEmitter = new NativeEventEmitter(MyEventModule);
    const subscription = eventEmitter.addListener('ON_SERMON_UPDATE', onEventReceived);

    return () => {
      subscription.remove();
    };
  }, [onEventReceived]);
}
