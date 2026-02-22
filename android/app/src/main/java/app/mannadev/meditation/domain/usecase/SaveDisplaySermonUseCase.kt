package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.SermonPrefsDataSource
import app.mannadev.meditation.dto.SermonDto
import javax.inject.Inject

class SaveDisplaySermonUseCase @Inject constructor(
    private val prefsDataSource: SermonPrefsDataSource
) {

    /**
     * Saves the sermon to preferences unconditionally.
     */
    suspend operator fun invoke(sermon: SermonDto) {
        prefsDataSource.saveDisplaySermon(sermon)
    }
}