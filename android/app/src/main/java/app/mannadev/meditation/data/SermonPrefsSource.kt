package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto

interface SermonPrefsSource {
    suspend fun getDisplaySermon(): SermonDto?
    suspend fun saveDisplaySermon(sermon: SermonDto)
    suspend fun clearDisplaySermon()
}
