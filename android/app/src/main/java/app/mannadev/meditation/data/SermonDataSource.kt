package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto

interface SermonDataSource {

    suspend fun getDisplaySermon(): SermonDto?

}