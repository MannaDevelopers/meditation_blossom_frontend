import XCTest
@testable import meditation_blossom

final class WorshipSermonSyncTests: XCTestCase {

  // MARK: - isAllOrUnknownSetting

  func testIsAllOrUnknownSettingTrueWhenNil() {
    XCTAssertTrue(WorshipSermonSync.isAllOrUnknownSetting(nil))
  }

  func testIsAllOrUnknownSettingTrueWhenEmpty() {
    XCTAssertTrue(WorshipSermonSync.isAllOrUnknownSetting(""))
  }

  func testIsAllOrUnknownSettingTrueWhenAll() {
    XCTAssertTrue(WorshipSermonSync.isAllOrUnknownSetting("ALL"))
  }

  func testIsAllOrUnknownSettingFalseWhenSpecificWorshipType() {
    XCTAssertFalse(WorshipSermonSync.isAllOrUnknownSetting("SUN_1150"))
  }

  // MARK: - shouldApplyWeeklyEvent

  func testShouldApplyWeeklyEventFalseWhenSettingUnknown() {
    XCTAssertFalse(WorshipSermonSync.shouldApplyWeeklyEvent(worshipType: "SUN_1150", stored: nil))
  }

  func testShouldApplyWeeklyEventFalseWhenSettingIsAll() {
    XCTAssertFalse(WorshipSermonSync.shouldApplyWeeklyEvent(worshipType: "SUN_1150", stored: "ALL"))
  }

  func testShouldApplyWeeklyEventFalseWhenSettingIsDifferentWorshipType() {
    XCTAssertFalse(WorshipSermonSync.shouldApplyWeeklyEvent(worshipType: "SUN_1150", stored: "SUN_0950"))
  }

  func testShouldApplyWeeklyEventTrueWhenSettingMatches() {
    XCTAssertTrue(WorshipSermonSync.shouldApplyWeeklyEvent(worshipType: "SUN_1150", stored: "SUN_1150"))
  }

  // MARK: - weeklySermonId

  func testWeeklySermonIdCombinesWeekAndWorshipType() {
    XCTAssertEqual(WorshipSermonSync.weeklySermonId(week: "2026-W37", worshipType: "SUN_1150"), "2026-W37_SUN_1150")
  }

  // MARK: - resolveWorshipDateTime / hasWorshipTimeArrived ([ISSUE-315])

  // 로컬 타임존과 무관하게 검증하려면 계산도 같은 타임존 기준이어야 하므로, 여기서 직접
  // 구성한 기대값도 항상 TimeZone.current를 명시해서 만든다(resolveWorshipDateTime과 동일 조건).
  private func expectedDate(year: Int, month: Int, day: Int, hour: Int, minute: Int) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone.current
    var components = DateComponents()
    components.year = year
    components.month = month
    components.day = day
    components.hour = hour
    components.minute = minute
    return calendar.date(from: components)!
  }

  func testResolveWorshipDateTimeAtIsoWeekEpochAnchor() {
    // 1970-W01 Monday = 1969-12-29 -> Sat(1970-01-03) 17:00, Sun(1970-01-04) 09:50
    XCTAssertEqual(
      WorshipSermonSync.resolveWorshipDateTime(week: "1970-W01", worshipType: "SAT_1700"),
      expectedDate(year: 1970, month: 1, day: 3, hour: 17, minute: 0)
    )
    XCTAssertEqual(
      WorshipSermonSync.resolveWorshipDateTime(week: "1970-W01", worshipType: "SUN_0950"),
      expectedDate(year: 1970, month: 1, day: 4, hour: 9, minute: 50)
    )
  }

  func testResolveWorshipDateTimeOrdersFourWorshipTimesWithinSameWeek() {
    let week = "2026-W37"
    let times = ["SAT_1700", "SUN_0950", "SUN_1150", "SUN_1430"]
      .compactMap { WorshipSermonSync.resolveWorshipDateTime(week: week, worshipType: $0) }
    XCTAssertEqual(times.count, 4)
    for i in 1..<times.count {
      XCTAssertLessThan(times[i - 1], times[i])
    }
  }

  func testResolveWorshipDateTimeReturnsNilForMalformedInput() {
    XCTAssertNil(WorshipSermonSync.resolveWorshipDateTime(week: "", worshipType: "SUN_0950"))
    XCTAssertNil(WorshipSermonSync.resolveWorshipDateTime(week: "2026-37", worshipType: "SUN_0950"))
    XCTAssertNil(WorshipSermonSync.resolveWorshipDateTime(week: "2026-W00", worshipType: "SUN_0950"))
    XCTAssertNil(WorshipSermonSync.resolveWorshipDateTime(week: "2026-W54", worshipType: "SUN_0950"))
    XCTAssertNil(WorshipSermonSync.resolveWorshipDateTime(week: "2026-W37", worshipType: "UNKNOWN"))
  }

  func testHasWorshipTimeArrivedBoundary() {
    let week = "2026-W37"
    let worshipType = "SUN_1150"
    let scheduled = WorshipSermonSync.resolveWorshipDateTime(week: week, worshipType: worshipType)!

    XCTAssertFalse(WorshipSermonSync.hasWorshipTimeArrived(week: week, worshipType: worshipType, now: scheduled.addingTimeInterval(-1)))
    XCTAssertTrue(WorshipSermonSync.hasWorshipTimeArrived(week: week, worshipType: worshipType, now: scheduled))
    XCTAssertTrue(WorshipSermonSync.hasWorshipTimeArrived(week: week, worshipType: worshipType, now: scheduled.addingTimeInterval(1)))
  }

  func testHasWorshipTimeArrivedFailsOpenWhenUnparseable() {
    XCTAssertTrue(WorshipSermonSync.hasWorshipTimeArrived(week: nil, worshipType: "SUN_0950"))
    XCTAssertTrue(WorshipSermonSync.hasWorshipTimeArrived(week: "2026-W37", worshipType: nil))
    XCTAssertTrue(WorshipSermonSync.hasWorshipTimeArrived(week: "not-a-week", worshipType: "SUN_0950"))
  }

  // MARK: - shouldApplyWeeklyEvent 예배시간 게이팅

  func testShouldApplyWeeklyEventWithoutWeekDefaultsToImmediateApply() {
    // week를 넘기지 않는 기존 호출부와의 하위 호환성 — 시각 판별 불가로 간주해 항상 즉시 반영.
    XCTAssertTrue(WorshipSermonSync.shouldApplyWeeklyEvent(worshipType: "SUN_1150", stored: "SUN_1150"))
  }

  func testShouldApplyWeeklyEventFalseWhenMatchedButTimeNotArrivedYet() {
    let week = "2026-W37"
    let scheduled = WorshipSermonSync.resolveWorshipDateTime(week: week, worshipType: "SUN_1150")!
    XCTAssertFalse(
      WorshipSermonSync.shouldApplyWeeklyEvent(
        worshipType: "SUN_1150", stored: "SUN_1150", week: week, now: scheduled.addingTimeInterval(-1)
      )
    )
  }

  func testShouldApplyWeeklyEventTrueWhenMatchedAndTimeHasArrived() {
    let week = "2026-W37"
    let scheduled = WorshipSermonSync.resolveWorshipDateTime(week: week, worshipType: "SUN_1150")!
    XCTAssertTrue(
      WorshipSermonSync.shouldApplyWeeklyEvent(
        worshipType: "SUN_1150", stored: "SUN_1150", week: week, now: scheduled
      )
    )
  }

  // MARK: - 대기열 병합 ([ISSUE-329] 지난주 항목 보존)

  private func entry(_ week: String, _ worshipType: String, _ title: String) -> [String: Any] {
    ["id": "\(week)_\(worshipType)", "title": title, "week": week, "worship_type": worshipType]
  }

  func testMergePendingEntriesKeepsPreviousWeekEntries() {
    let existing = [entry("2026-W36", "SUN_0950", "지난주")]
    let incoming = entry("2026-W37", "SAT_1700", "이번주 토요")

    let merged = WorshipSermonSync.mergePendingEntries(
      existing, incoming: incoming, week: "2026-W37", worshipType: "SAT_1700"
    )

    XCTAssertEqual(merged.count, 2)
    XCTAssertEqual(merged.first?["title"] as? String, "지난주")
    XCTAssertEqual(merged.last?["title"] as? String, "이번주 토요")
  }

  func testMergePendingEntriesReplacesOnlySameWeekAndWorshipType() {
    let existing = [
      entry("2026-W36", "SUN_0950", "지난주 9시50분"),
      entry("2026-W37", "SUN_0950", "옛 이번주 9시50분"),
    ]
    let incoming = entry("2026-W37", "SUN_0950", "새 이번주 9시50분")

    let merged = WorshipSermonSync.mergePendingEntries(
      existing, incoming: incoming, week: "2026-W37", worshipType: "SUN_0950"
    )

    XCTAssertEqual(merged.map { $0["title"] as? String }, ["지난주 9시50분", "새 이번주 9시50분"])
  }

  func testMergePendingEntriesKeepsOnlyMostRecentWeeks() {
    let existing = ["2026-W34", "2026-W35", "2026-W36"].map { entry($0, "SUN_0950", $0) }
    let incoming = entry("2026-W37", "SUN_0950", "w37")

    let merged = WorshipSermonSync.mergePendingEntries(
      existing, incoming: incoming, week: "2026-W37", worshipType: "SUN_0950"
    )

    XCTAssertEqual(
      merged.compactMap { $0["week"] as? String }.sorted(), ["2026-W35", "2026-W36", "2026-W37"]
    )
  }
}
