//
//  BibleDbHelper.swift
//  meditation_blossom
//
//  Created by 최상준 on 4/9/26.
//

import Foundation
import SQLite3

@objcMembers
final class BibleDbHelper: NSObject {
    static let shared = BibleDbHelper()

    private var db: OpaquePointer?
    private var resolvedTables: (books: String?, verses: String?)?

    override init() {
        super.init()
        openDatabase()
    }

    deinit {
        if db != nil {
            sqlite3_close(db)
        }
    }

    private func openDatabase() {
        guard db == nil else { return }

        guard let path = databasePath() else {
            NSLog("❌ Bible DB file not found in bundle")
            return
        }

        if sqlite3_open(path, &db) != SQLITE_OK {
            let message = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            NSLog("❌ Failed to open DB: %@", message)
            if db != nil {
                sqlite3_close(db)
                db = nil
            }
            return
        }

        NSLog("✅ Bible DB opened: %@", path)
        resolvedTables = nil
    }

    private func databasePath() -> String? {
        // Bundle.main 대신 Bundle(for:) 사용:
        // App Extension 타겟(PushNotificationService)에서는 Bundle.main이
        // Extension 자신의 번들을 가리키므로 이 방식도 동작하지만,
        // 명시적으로 이 클래스가 컴파일된 번들에서 찾도록 지정하여
        // 멀티 타겟 환경에서도 안전하게 동작하도록 한다.
        Bundle(for: BibleDbHelper.self).path(forResource: "bible", ofType: "db")
    }

    @objc(getVersesWithBook:chapter:verseStart:verseEnd:)
    func getVerses(
        book: String,
        chapter: Int,
        verseStart: Int,
        verseEnd: Int
    ) -> String {
        guard let db else {
            NSLog("❌ DB is not open")
            return ""
        }

        let tableNames = tables()
        guard let booksTable = tableNames.books, let versesTable = tableNames.verses else {
            NSLog("❌ Could not resolve Bible DB tables")
            return ""
        }

        let query = """
        SELECT b.name, v.chapter, v.verse, v.text
        FROM "\(versesTable)" v
        JOIN "\(booksTable)" b ON v.book_id = b.id
        WHERE b.name = ?
          AND v.chapter = ?
          AND v.verse BETWEEN ? AND ?
        ORDER BY v.verse ASC
        """

        var stmt: OpaquePointer?
        defer {
            if stmt != nil {
                sqlite3_finalize(stmt)
            }
        }

        guard sqlite3_prepare_v2(db, query, -1, &stmt, nil) == SQLITE_OK else {
            let message = String(cString: sqlite3_errmsg(db))
            NSLog("❌ Failed to prepare query: %@", message)
            return ""
        }

        sqlite3_bind_text(stmt, 1, (book as NSString).utf8String, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(stmt, 2, Int32(chapter))
        sqlite3_bind_int(stmt, 3, Int32(verseStart))
        sqlite3_bind_int(stmt, 4, Int32(verseEnd))

        var lines: [String] = []

        while sqlite3_step(stmt) == SQLITE_ROW {
            let verseValue = Int(sqlite3_column_int(stmt, 2))
          let textValue = sqlite3_column_text(stmt, 3)
              .map { String(cString: $0) }?
              .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

            if textValue.isEmpty {
                continue
            }

            if verseValue > 0 {
                lines.append("\(verseValue) \(textValue)")
            } else {
                lines.append(textValue)
            }
        }

        return lines.joined(separator: "\n")
    }

    @objc func availableTranslations() -> [String] {
        guard let db else { return [] }

        if tableExists("translations") {
            let query = "SELECT translation FROM translations ORDER BY translation ASC"
            var stmt: OpaquePointer?
            defer {
                if stmt != nil {
                    sqlite3_finalize(stmt)
                }
            }

            guard sqlite3_prepare_v2(db, query, -1, &stmt, nil) == SQLITE_OK else {
                NSLog("❌ Failed to prepare translations query: %s", sqlite3_errmsg(db))
                return []
            }

            var result: [String] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                if let cString = sqlite3_column_text(stmt, 0) {
                    result.append(String(cString: cString))
                }
            }
            return result
        }

        if let source = metaValue(forKey: "source"), !source.isEmpty {
            return [source]
        }

        if tableExists("books"), tableExists("verses") {
            return ["default"]
        }

        return []
    }

    @objc func hasDatabase() -> Bool {
        db != nil
    }

    private func tables() -> (books: String?, verses: String?) {
        if let resolvedTables {
            return resolvedTables
        }

        let candidates = [
            ("books", "verses"),
            ("KorRV_books", "KorRV_verses")
        ]

        for (booksTable, versesTable) in candidates {
            if tableExists(booksTable), tableExists(versesTable) {
                let tables = (booksTable, versesTable)
                resolvedTables = tables
                return tables
            }
        }

        if let translation = availableTranslations().first, translation != "default" {
            let booksTable = "\(translation)_books"
            let versesTable = "\(translation)_verses"
            if tableExists(booksTable), tableExists(versesTable) {
                let tables = (booksTable, versesTable)
                resolvedTables = tables
                return tables
            }
        }

        resolvedTables = (nil, nil)
        return resolvedTables!
    }

    private func metaValue(forKey key: String) -> String? {
        guard let db, tableExists("meta") else { return nil }

        let query = "SELECT value FROM meta WHERE key = ? LIMIT 1"
        var stmt: OpaquePointer?
        defer {
            if stmt != nil {
                sqlite3_finalize(stmt)
            }
        }

        guard sqlite3_prepare_v2(db, query, -1, &stmt, nil) == SQLITE_OK else {
            NSLog("❌ Failed to prepare meta query: %s", sqlite3_errmsg(db))
            return nil
        }

        sqlite3_bind_text(stmt, 1, (key as NSString).utf8String, -1, SQLITE_TRANSIENT)

        guard sqlite3_step(stmt) == SQLITE_ROW,
              let cString = sqlite3_column_text(stmt, 0) else {
            return nil
        }

        return String(cString: cString)
    }

    private func tableExists(_ tableName: String) -> Bool {
        guard let db else { return false }

        let query = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
        var stmt: OpaquePointer?
        defer {
            if stmt != nil {
                sqlite3_finalize(stmt)
            }
        }

        guard sqlite3_prepare_v2(db, query, -1, &stmt, nil) == SQLITE_OK else {
            return false
        }

        sqlite3_bind_text(stmt, 1, (tableName as NSString).utf8String, -1, SQLITE_TRANSIENT)
        return sqlite3_step(stmt) == SQLITE_ROW
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
