package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.QtPrefsDataSource
import javax.inject.Inject

class ClearQtPreferenceUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource
) {
    suspend operator fun invoke() {
        prefsDataSource.clearDisplayQt()
    }
}
