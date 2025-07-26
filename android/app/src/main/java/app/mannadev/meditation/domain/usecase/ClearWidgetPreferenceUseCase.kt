package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.EditableSermonDataSource
import app.mannadev.meditation.di.PrefsDataSource
import javax.inject.Inject

class ClearWidgetPreferenceUseCase @Inject constructor(
    @PrefsDataSource private val prefsDataSource: EditableSermonDataSource
) {

    operator fun invoke() = prefsDataSource::clearDisplaySermon
}