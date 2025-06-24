package app.mannadev.meditation.domain

import app.mannadev.meditation.model.Verse

interface SermonRepository {
    suspend fun getDisplaySermon(): Verse?
}