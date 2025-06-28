package app.mannadev.meditation.domain

import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.di.PrefsDataSource
import javax.inject.Inject

class SaveDisplaySermonUseCase @Inject constructor(
    @PrefsDataSource private val prefsDataSource: SermonDataSource
) {
    suspend operator fun invoke(sermon: app.mannadev.meditation.dto.SermonDto) {
        prefsDataSource.saveDisplaySermon(sermon)
    }
}