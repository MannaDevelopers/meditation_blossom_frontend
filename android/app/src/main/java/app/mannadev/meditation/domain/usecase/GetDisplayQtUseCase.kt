package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.data.QtPrefsDataSource
import app.mannadev.meditation.dto.QtDto
import javax.inject.Inject

class GetDisplayQtUseCase @Inject constructor(
    private val prefsDataSource: QtPrefsDataSource
) {
    suspend operator fun invoke(): QtDto? {
        return prefsDataSource.getDisplayQt()
    }
}
