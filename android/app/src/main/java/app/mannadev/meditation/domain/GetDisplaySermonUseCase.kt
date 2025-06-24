package app.mannadev.meditation.domain

import app.mannadev.meditation.data.SermonRepository
import app.mannadev.meditation.data.Verse

class GetDisplaySermonUseCase(
    private val sermonRepository: SermonRepository
) {
    suspend operator fun invoke(): Verse? {
        return sermonRepository.getDisplaySermon()
    }
} 