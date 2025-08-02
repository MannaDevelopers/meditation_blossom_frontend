package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto

interface EditableSermonDataSource: SermonDataSource {

    suspend fun saveDisplaySermon(sermon: SermonDto)

    suspend fun clearDisplaySermon()
}