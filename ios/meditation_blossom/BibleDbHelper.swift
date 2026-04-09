//
//  BibleDbHelper.swift
//  meditation_blossom
//
//  Created by 최상준 on 4/9/26.
//

import Foundation
import SQLite3

class BibleDbHelper {
    private var db: OpaquePointer?

    init() {
        openDatabase()
    }

    private func openDatabase() {
        if let path = Bundle.main.path(forResource: "bible", ofType: "db") {
            sqlite3_open(path, &db)
        }
    }

    func getVerses(book: String, chapter: Int, from: Int, to: Int) -> [String] {
        var result: [String] = []

        let query = """
        SELECT text FROM verses
        WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ?
        """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, query, -1, &stmt, nil)

        sqlite3_bind_text(stmt, 1, (book as NSString).utf8String, -1, nil)
        sqlite3_bind_int(stmt, 2, Int32(chapter))
        sqlite3_bind_int(stmt, 3, Int32(from))
        sqlite3_bind_int(stmt, 4, Int32(to))

        while sqlite3_step(stmt) == SQLITE_ROW {
            if let text = sqlite3_column_text(stmt, 0) {
                result.append(String(cString: text))
            }
        }

        sqlite3_finalize(stmt)

        return result
    }
}
