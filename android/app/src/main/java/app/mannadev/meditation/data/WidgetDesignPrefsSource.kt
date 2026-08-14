package app.mannadev.meditation.data

import app.mannadev.meditation.dto.WidgetDesignDto

interface WidgetDesignPrefsSource {
    suspend fun getDesign(): WidgetDesignDto?
    suspend fun saveDesign(design: WidgetDesignDto)
    suspend fun clearDesign()
}
