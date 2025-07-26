package app.mannadev.meditation.domain.usecase

import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.model.Sermon
import java.time.LocalDateTime
import javax.inject.Inject

class GetDisplaySermonUseCase @Inject constructor(
    private val sermonRepository: SermonRepository
) {
    suspend operator fun invoke(): Sermon? {
        return sermonRepository.getDisplaySermon()
    }

} 