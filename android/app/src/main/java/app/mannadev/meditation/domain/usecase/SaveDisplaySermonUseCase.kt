package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.EditableSermonDataSource
import app.mannadev.meditation.di.PrefsDataSource
import app.mannadev.meditation.dto.SermonDto
import javax.inject.Inject

class SaveDisplaySermonUseCase @Inject constructor(
    @PrefsDataSource private val prefsDataSource: EditableSermonDataSource
) {

    /**
     * Saves the sermon to preferences if it is not older than the currently saved sermon.
     */
    operator fun invoke(sermon: SermonDto) = prefsDataSource::saveDisplaySermon
}