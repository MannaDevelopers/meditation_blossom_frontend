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
    private let fallbackTranslation = "KorRV"

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
    }

    private func databasePath() -> String? {
        let candidates = [
            ("bible", "db"),
            ("bible", "sqlite"),
            ("bible", "sqlite3"),
            ("Bible", "db"),
            ("Bible", "sqlite"),
            ("Bible", "sqlite3")
        ]

        for (resource, ext) in candidates {
            if let path = Bundle.main.path(forResource: resource, ofType: ext) {
                return path
            }
        }

        return nil
    }

    @objc(fetchVersesWithTranslation:book:chapter:start:end:)
    func fetchVerses(
        translation: String,
        book: String,
        chapter: Int,
        start: Int,
        end: Int
    ) -> [NSDictionary] {

        guard let db else {
            NSLog("❌ DB is not open")
            return []
        }

        let resolvedTranslation = normalizedTranslation(translation)
        let tableNames = tables(for: resolvedTranslation)
        guard let booksTable = tableNames.books, let versesTable = tableNames.verses else {
            NSLog("❌ Could not resolve Bible DB tables for translation %@", resolvedTranslation)
            return []
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
            return []
        }

        sqlite3_bind_text(stmt, 1, (book as NSString).utf8String, -1, SQLITE_TRANSIENT)
        sqlite3_bind_int(stmt, 2, Int32(chapter))
        sqlite3_bind_int(stmt, 3, Int32(start))
        sqlite3_bind_int(stmt, 4, Int32(end))

        var result: [NSDictionary] = []

        while sqlite3_step(stmt) == SQLITE_ROW {
            let bookName = sqlite3_column_text(stmt, 0).map { String(cString: $0) } ?? ""
            let chapterValue = Int(sqlite3_column_int(stmt, 1))
            let verseValue = Int(sqlite3_column_int(stmt, 2))
            let textValue = sqlite3_column_text(stmt, 3).map { String(cString: $0) } ?? ""

            result.append([
                "book": bookName,
                "chapter": chapterValue,
                "verse": verseValue,
                "text": textValue
            ] as NSDictionary)
        }

        return result
    }

    @objc func availableTranslations() -> [String] {
        guard let db else { return [] }

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

    @objc func hasDatabase() -> Bool {
        db != nil
    }

    private func normalizedTranslation(_ value: String) -> String {
        guard isSafeIdentifier(value), !value.isEmpty else {
            return fallbackTranslation
        }
        return value
    }

    private func tables(for translation: String) -> (books: String?, verses: String?) {
        let translatedBooks = "\(translation)_books"
        let translatedVerses = "\(translation)_verses"

        if tableExists(translatedBooks), tableExists(translatedVerses) {
            return (translatedBooks, translatedVerses)
        }

        if tableExists("books"), tableExists("verses") {
            return ("books", "verses")
        }

        return (nil, nil)
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

    private func isSafeIdentifier(_ value: String) -> Bool {
        let pattern = "^[A-Za-z0-9_]+$"
        return value.range(of: pattern, options: .regularExpression) != nil
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
