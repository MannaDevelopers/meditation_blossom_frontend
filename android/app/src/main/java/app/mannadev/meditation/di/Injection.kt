package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.data.SermonLocalDataSource
import app.mannadev.meditation.data.SermonRepository
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.GetDisplaySermonUseCase

object Injection {
    private var sermonRepository: SermonRepository? = null
    private var getDisplaySermonUseCase: GetDisplaySermonUseCase? = null


    fun provideSermonRepository(context: Context): SermonRepository {
        val dataSource = SermonLocalDataSource(context)
        return sermonRepository ?: SermonRepositoryImpl(dataSource)
            .also { sermonRepository = it }
    }

    fun provideGetDisplaySermonUseCase(context: Context): GetDisplaySermonUseCase {
        return getDisplaySermonUseCase ?: GetDisplaySermonUseCase(provideSermonRepository(context))
            .also { getDisplaySermonUseCase = it }
    }

    fun clear() {
        sermonRepository = null
        getDisplaySermonUseCase = null
    }
} 