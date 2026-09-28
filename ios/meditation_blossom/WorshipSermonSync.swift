import Foundation

/// sermons-v2(worship_type별 예배)와 레거시 sermon_events(_v2) FCM을 앱 종료 상태에서도
/// 위젯에 올바르게 반영하기 위한 공용 판단/저장 로직([#306], [#307] iOS 파트).
///
/// NSE(PushNotificationService)는 RN AsyncStorage를 읽을 수 없어 App Group만 공유하므로,
/// 이 타입은 App Group을 유일한 설정 소스로 삼는다. App Group에 아직 값이 없는 경우(업데이트
/// 직후 설정 화면을 한 번도 안 연 기존 사용자)는 JS 기본값("SUN_0950")이 아니라 "알 수 없음"으로
/// 취급한다 — 레거시는 기존 동작(전체와 동일하게 위젯 반영)을, sermons-v2는 위젯 미반영(대기열
/// 저장만)을 유지해야 하기 때문이다. Android(`WorshipSetting.kt`/`WeeklySermons.kt`)와
/// JS(`src/types/Sermon.ts`, `sermonService.ts`)에서 규칙이 바뀌면 여기도 같이 고쳐야 한다.
@objc(WorshipSermonSync)
final class WorshipSermonSync: NSObject {

    private enum Constants {
        static let appGroupId = "group.mannachurch.meditationblossom"
    }

    /// JS `USER_WORSHIP_SETTING_KEY`. App Group 미러 값(원시 문자열, JSON 아님).
    @objc static let userWorshipSettingKey = "user_worship_setting"
    /// 종료 상태에서 받은 sermons-v2 항목을 앱 실행 시 JS가 `weekly_sermons`로 병합해가도록
    /// 임시로 쌓아두는 대기열(JSON 배열 문자열). JS `WEEKLY_SERMONS_KEY`와는 별도 키다.
    @objc static let weeklySermonsPendingKey = "weekly_sermons_pending"
    /// JS `LEGACY_SERMON_CACHE_KEY` 미러 — '전체'가 아닐 때 받은 레거시 payload를 보관해뒀다가
    /// 나중에 '전체'로 전환 시 재조회 없이 보여줄 수 있게 한다.
    @objc static let legacySermonCacheKey = "legacy_sermon_cache"
    /// JS `WorshipSetting`의 '전체' 값.
    @objc static let allSetting = "ALL"

    private static func appGroupDefaults() -> UserDefaults? {
        UserDefaults(suiteName: Constants.appGroupId)
    }

    // MARK: - Setting

    /// App Group에 미러된 현재 설정 원시값. nil이면 "알 수 없음"(레거시=전체와 동일, sermons-v2=대기만).
    @objc static func currentSetting() -> String? {
        appGroupDefaults()?.string(forKey: userWorshipSettingKey)
    }

    /// 설정이 바뀔 때(SettingsScreen) 또는 앱 최초 실행 시 RN AsyncStorage 값을 백필할 때 호출.
    @objc static func mirrorSetting(_ value: String) {
        guard let defaults = appGroupDefaults() else { return }
        defaults.set(value, forKey: userWorshipSettingKey)
        defaults.synchronize()
    }

    /// 레거시 sermon_events(_v2)가 위젯/'지금 화면' 슬롯에 반영돼야 하는 설정인지.
    /// '전체'이거나 App Group에 설정이 아직 없으면(알 수 없음) 기존 동작을 유지한다.
    @objc static func isAllOrUnknownSetting(_ stored: String?) -> Bool {
        guard let stored, !stored.isEmpty else { return true }
        return stored == allSetting
    }

    /// sermons-v2 단일 이벤트가 위젯에 즉시 반영돼야 하는지. 설정을 모르는 상태에서 위젯을
    /// 엉뚱한 예배로 덮어쓰면 안 되므로, 알 수 없으면 무조건 false(대기열에만 쌓임).
    /// 설정과 일치해도 그 예배 시각이 아직 안 됐으면 false([ISSUE-315]) — FCM은 주보 등록
    /// 시점에 미리 도착하므로, 실제 예배가 시작되기 전까지는 위젯에 반영하면 안 된다.
    /// [week]을 넘기지 않으면(기존 호출부 호환) 시각 판별 불가로 간주해 항상 즉시 반영한다.
    @objc static func shouldApplyWeeklyEvent(worshipType: String, stored: String?, week: String? = nil, now: Date = Date()) -> Bool {
        guard let stored, !stored.isEmpty, stored != allSetting else { return false }
        guard stored == worshipType else { return false }
        return hasWorshipTimeArrived(week: week, worshipType: worshipType, now: now)
    }

    // MARK: - sermons-v2 id fallback

    /// sermons-v2 payload엔 id가 없다 — Firestore 문서 ID 규칙과 동일하게 구성한다
    /// (Android `WeeklySermons.parseEvent`, JS `upsertWeeklySermonFromEvent`와 동일).
    @objc static func weeklySermonId(week: String, worshipType: String) -> String {
        "\(week)_\(worshipType)"
    }

    // MARK: - Pending weekly queue

    /// sermonJSON(JS `Sermon` 모양의 JSON 문자열)을 대기열에 병합해 저장한다. JS
    /// `upsertWeeklySermonFromEvent`/Android `WeeklySermons.merge`와 동일한 규칙: 같은 week의
    /// 다른 worship_type 항목은 보존하고, 같은 worship_type 항목은 교체하며, 다른 week 항목은
    /// 모두 버린다(주가 바뀌는 시점에 이전 주 예배와 섞이지 않도록).
    @objc static func appendPendingWeeklySermon(_ sermonJSON: String, week: String, worshipType: String) {
        guard let defaults = appGroupDefaults(),
              let data = sermonJSON.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        let sameWeekOthers = pendingEntries(defaults: defaults).filter { entry in
            (entry["week"] as? String) == week && (entry["worship_type"] as? String) != worshipType
        }
        persistPending(sameWeekOthers + [parsed], defaults: defaults)
    }

    private static func pendingEntries(defaults: UserDefaults) -> [[String: Any]] {
        guard let raw = defaults.string(forKey: weeklySermonsPendingKey),
              let data = raw.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return array
    }

    private static func persistPending(_ entries: [[String: Any]], defaults: UserDefaults) {
        guard let data = try? JSONSerialization.data(withJSONObject: entries),
              let json = String(data: data, encoding: .utf8) else { return }
        defaults.set(json, forKey: weeklySermonsPendingKey)
        defaults.synchronize()
    }

    /// 대기열([weeklySermonsPendingKey])에서 [worshipType]과 일치하는 항목을 찾는다. 위젯
    /// Extension(`MeditationBlossomWidget.swift`)이 App Group에서 직접 읽어 Timeline을
    /// 구성하는 데 쓴다([ISSUE-315]) — 앱이 실행되기 전이라 JS `weekly_sermons` 캐시가 아직
    /// 이 항목을 병합해가지 않은 상태에서도(앱이 오래 안 열린 경우) 위젯이 스스로 반영할 수 있다.
    @objc static func matchingPendingEntry(worshipType: String) -> [String: Any]? {
        guard let defaults = appGroupDefaults() else { return nil }
        return pendingEntries(defaults: defaults).first { ($0["worship_type"] as? String) == worshipType }
    }

    // MARK: - Worship schedule ([ISSUE-315])

    private struct Schedule {
        let isoWeekday: Int // ISO 8601: 월=1 ... 일=7
        let hour: Int
        let minute: Int
    }

    // JS `src/utils/worshipSchedule.ts`, Android `WorshipSchedule.kt`와 반드시 동일하게
    // 유지해야 한다 — 바뀌면 3곳 다 고친다.
    private static let schedule: [String: Schedule] = [
        "SAT_1700": Schedule(isoWeekday: 6, hour: 17, minute: 0),
        "SUN_0950": Schedule(isoWeekday: 7, hour: 9, minute: 50),
        "SUN_1150": Schedule(isoWeekday: 7, hour: 11, minute: 50),
        "SUN_1430": Schedule(isoWeekday: 7, hour: 14, minute: 30),
    ]

    /// week("2026-W37") + worshipType이 가리키는 실제 예배 시작 시각(기기 로컬 타임존).
    /// 해석할 수 없으면 nil. `Calendar(identifier: .iso8601)`의 `yearForWeekOfYear`/
    /// `weekOfYear`로 ISO 8601 주차를 그대로 활용한다 — `weekday` 값은 이 식별자를 써도
    /// Apple 고유 번호(일=1...토=7)라서 ISO 요일(월=1...일=7)을 변환해 넘긴다.
    @objc static func resolveWorshipDateTime(week: String, worshipType: String) -> Date? {
        guard week.count == 8 else { return nil }
        let chars = Array(week)
        guard chars[4] == "-", chars[5] == "W" else { return nil }
        guard let year = Int(String(chars[0...3])), let weekNumber = Int(String(chars[6...7])) else { return nil }
        guard weekNumber >= 1, weekNumber <= 53, let sched = schedule[worshipType] else { return nil }

        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone.current

        var components = DateComponents()
        components.yearForWeekOfYear = year
        components.weekOfYear = weekNumber
        components.weekday = (sched.isoWeekday % 7) + 1 // ISO(월=1..일=7) -> Apple(일=1..토=7)
        components.hour = sched.hour
        components.minute = sched.minute
        components.second = 0

        return calendar.date(from: components)
    }

    /// week/worshipType이 가리키는 예배 시각에 [now]가 이미 도달했는지. week/worshipType
    /// 조합을 해석할 수 없으면(방어적으로) true — 판별 불가한 데이터를 영원히 숨기는 것보다
    /// 기존 동작(즉시 반영)으로 안전하게 폴백한다.
    @objc static func hasWorshipTimeArrived(week: String?, worshipType: String?, now: Date = Date()) -> Bool {
        guard let week, !week.isEmpty, let worshipType, !worshipType.isEmpty else { return true }
        guard let scheduled = resolveWorshipDateTime(week: week, worshipType: worshipType) else { return true }
        return now >= scheduled
    }
}
