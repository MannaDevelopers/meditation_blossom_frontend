package app.mannadev.meditation.domain

import app.mannadev.meditation.model.Sermon
import java.time.LocalDate

interface SermonRepository {
    suspend fun getDisplaySermon(): Sermon?
    suspend fun getDisplaySermonForDate(date: LocalDate): Sermon?
}