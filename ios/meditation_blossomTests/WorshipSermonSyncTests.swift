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
}
