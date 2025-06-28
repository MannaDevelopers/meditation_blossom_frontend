package app.mannadev.meditation.domain

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