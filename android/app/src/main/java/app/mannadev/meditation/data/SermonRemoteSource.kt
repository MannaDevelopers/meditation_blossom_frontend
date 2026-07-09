package app.mannadev.meditation.data

import app.mannadev.meditation.dto.SermonDto

interface SermonRemoteSource {
    suspend fun fetchLatestSermon(): SermonDto?
}
