package app.mannadev.meditation.data

import app.mannadev.meditation.dto.QtDto

interface QtPrefsSource {
    suspend fun getDisplayQt(): QtDto?
    suspend fun saveDisplayQt(qt: QtDto)
    suspend fun clearDisplayQt()
}
