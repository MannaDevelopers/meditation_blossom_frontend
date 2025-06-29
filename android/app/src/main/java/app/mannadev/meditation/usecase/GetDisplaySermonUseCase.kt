package app.mannadev.meditation.usecase

import app.mannadev.meditation.domain.SermonRepository
import app.mannadev.meditation.model.Sermon
import java.time.LocalDateTime
import javax.inject.Inject

class GetDisplaySermonUseCase @Inject constructor(
    private val sermonRepository: SermonRepository
) {
    suspend operator fun invoke(date: LocalDateTime): Sermon? {
        return sermonRepository.getDisplaySermon()
    }

} 