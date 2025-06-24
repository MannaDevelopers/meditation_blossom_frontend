package app.mannadev.meditation.domain

import app.mannadev.meditation.model.Verse
import javax.inject.Inject

class GetDisplaySermonUseCase @Inject constructor(
    private val sermonRepository: SermonRepository
) {
    suspend operator fun invoke(): Verse? {
        return sermonRepository.getDisplaySermon()
    }
} 