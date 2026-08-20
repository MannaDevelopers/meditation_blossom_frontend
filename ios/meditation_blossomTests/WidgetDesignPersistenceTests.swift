import XCTest
import UIKit
@testable import meditation_blossom

final class WidgetDesignPersistenceTests: XCTestCase {
  private var tmpDir: URL!

  override func setUpWithError() throws {
    tmpDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
  }

  override func tearDownWithError() throws {
    try? FileManager.default.removeItem(at: tmpDir)
  }

  func testColorDesignPassesThroughWithoutTouchingFilesystem() throws {
    let json = ##"{"text":{"align":"left","color":"#000000","size":16,"weight":"regular"},"background":{"type":"color","value":"gradient-default"}}"##
    let result = try WidgetDesignPersistence.persist(designData: json, containerURL: tmpDir, backgroundFileName: "bg.jpg")
    let decoded = try JSONDecoder().decode(WidgetDesignPersistence.Design.self, from: Data(result.utf8))
    XCTAssertEqual(decoded.background.value, "gradient-default")
    XCTAssertFalse(FileManager.default.fileExists(atPath: tmpDir.appendingPathComponent("bg.jpg").path))
  }

  func testGalleryDesignDownsamplesAndRewritesPathToContainer() throws {
    let sourceURL = tmpDir.appendingPathComponent("source.png")
    try makeSolidColorImage(size: CGSize(width: 2000, height: 1500)).write(to: sourceURL)

    let json = ##"{"text":{"align":"center","color":"#FFFFFF","size":20,"weight":"bold"},"background":{"type":"gallery","value":"\##(sourceURL.absoluteString)","imageTransform":{"zoom":1.2,"focalX":0.5,"focalY":0.4}}}"##

    let result = try WidgetDesignPersistence.persist(designData: json, containerURL: tmpDir, backgroundFileName: "bg.jpg")
    let decoded = try JSONDecoder().decode(WidgetDesignPersistence.Design.self, from: Data(result.utf8))

    let expectedPath = tmpDir.appendingPathComponent("bg.jpg").path
    XCTAssertEqual(decoded.background.value, expectedPath)
    XCTAssertTrue(FileManager.default.fileExists(atPath: expectedPath))

    let writtenImage = UIImage(contentsOfFile: expectedPath)
    XCTAssertNotNil(writtenImage)
    XCTAssertLessThanOrEqual(max(writtenImage?.size.width ?? 0, writtenImage?.size.height ?? 0), 1024)
  }

  func testAlreadyPersistedPathIsReReadAndRewritten() throws {
    // 재편집 시 로드된 기존 디자인처럼 스킴 없는 절대 경로를 그대로 다시 저장하는 경우도 지원해야 한다.
    let existingPath = tmpDir.appendingPathComponent("bg.jpg")
    try makeSolidColorImage(size: CGSize(width: 800, height: 800)).write(to: existingPath)

    let json = ##"{"text":{"align":"left","color":"#000000","size":16,"weight":"regular"},"background":{"type":"gallery","value":"\##(existingPath.path)"}}"##
    let result = try WidgetDesignPersistence.persist(designData: json, containerURL: tmpDir, backgroundFileName: "bg.jpg")
    let decoded = try JSONDecoder().decode(WidgetDesignPersistence.Design.self, from: Data(result.utf8))
    XCTAssertEqual(decoded.background.value, existingPath.path)
  }

  func testInvalidJSONThrowsInvalidDesignJSON() {
    XCTAssertThrowsError(try WidgetDesignPersistence.persist(designData: "not json", containerURL: tmpDir, backgroundFileName: "bg.jpg")) { error in
      XCTAssertEqual(error as? WidgetDesignPersistence.PersistenceError, .invalidDesignJSON)
    }
  }

  func testUndecodableImageThrowsImageDecodeFailed() throws {
    let sourceURL = tmpDir.appendingPathComponent("not-an-image.png")
    try Data("garbage".utf8).write(to: sourceURL)
    let json = ##"{"text":{"align":"left","color":"#000000","size":16,"weight":"regular"},"background":{"type":"gallery","value":"\##(sourceURL.absoluteString)"}}"##

    XCTAssertThrowsError(try WidgetDesignPersistence.persist(designData: json, containerURL: tmpDir, backgroundFileName: "bg.jpg")) { error in
      XCTAssertEqual(error as? WidgetDesignPersistence.PersistenceError, .imageDecodeFailed)
    }
  }

  private func makeSolidColorImage(size: CGSize) throws -> Data {
    let renderer = UIGraphicsImageRenderer(size: size)
    let image = renderer.image { ctx in
      UIColor.systemBlue.setFill()
      ctx.fill(CGRect(origin: .zero, size: size))
    }
    guard let data = image.pngData() else { throw XCTSkip("PNG 인코딩 실패") }
    return data
  }
}
