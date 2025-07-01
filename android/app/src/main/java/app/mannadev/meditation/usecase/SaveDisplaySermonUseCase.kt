package app.mannadev.meditation.usecase

import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.di.PrefsDataSource
import app.mannadev.meditation.dto.SermonDto
import java.time.LocalDate
import javax.inject.Inject

class SaveDisplaySermonUseCase @Inject constructor(
    @PrefsDataSource private val prefsDataSource: SermonDataSource
) {

    /**
     * Saves the sermon to preferences if it is not older than the currently saved sermon.
     */
    suspend operator fun invoke(sermon: SermonDto) {
        val oldSermon = prefsDataSource.getDisplaySermon()
        if (oldSermon == null) {
            prefsDataSource.saveDisplaySermon(sermon)
            return
        }

        val oldDate = LocalDate.parse(oldSermon.date)
        val newDate = LocalDate.parse(sermon.date)
        if (!newDate.isBefore(oldDate)) {
            prefsDataSource.saveDisplaySermon(sermon)
        }
    }
}