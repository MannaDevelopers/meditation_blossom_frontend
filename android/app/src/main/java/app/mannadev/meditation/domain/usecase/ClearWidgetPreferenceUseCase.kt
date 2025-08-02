package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.SermonPrefsDataSource
import javax.inject.Inject

class ClearWidgetPreferenceUseCase @Inject constructor(
    private val prefsDataSource: SermonPrefsDataSource
) {

    suspend operator fun invoke() {
        prefsDataSource.clearDisplaySermon()
    }
}