package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto

interface QtRemoteSource {
    suspend fun fetchLatestQt(): QtDto?
}
