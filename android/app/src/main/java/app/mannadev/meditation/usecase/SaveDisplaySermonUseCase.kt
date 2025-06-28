package app.mannadev.meditation.usecase

import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.di.PrefsDataSource
import app.mannadev.meditation.dto.SermonDto
import javax.inject.Inject

class SaveDisplaySermonUseCase @Inject constructor(
    @PrefsDataSource private val prefsDataSource: SermonDataSource
) {
    suspend operator fun invoke(sermon: SermonDto) {
        prefsDataSource.saveDisplaySermon(sermon)
    }
}