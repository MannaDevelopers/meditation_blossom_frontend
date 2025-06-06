package app.mannadev.meditation

import android.content.Context
import app.mannadev.meditation.data.SermonLocalDataSource
import app.mannadev.meditation.data.SermonRepository
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.GetDisplaySermonUseCase

object Injection {

    private fun provideSermonRepository(context: Context): SermonRepository {
        return SermonRepositoryImpl(SermonLocalDataSource(context))
    }

    fun provideGetDisplaySermonUseCase(context: Context): GetDisplaySermonUseCase {
        return GetDisplaySermonUseCase(provideSermonRepository(context))
    }
} 