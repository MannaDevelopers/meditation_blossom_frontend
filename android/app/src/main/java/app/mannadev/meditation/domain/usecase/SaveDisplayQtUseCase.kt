package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.QtPrefsDataSource
import app.mannadev.meditation.dto.QtDto
import javax.inject.Inject

class SaveDisplayQtUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource
) {
    suspend operator fun invoke(qt: QtDto) {
        prefsDataSource.saveDisplayQt(qt)
    }
}
