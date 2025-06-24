package app.mannadev.meditation.di

import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.data.SermonLocalDataSource
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.SermonRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class) // Application-level dependencies
abstract class RepositoryModule {

    @Binds
    @Singleton // Binds the implementation to the interface, and makes it a singleton
    abstract fun bindSermonRepository(
        sermonRepositoryImpl: SermonRepositoryImpl
    ): SermonRepository

    @Binds
    @Singleton
    abstract fun bindSermonLocalDataSource(
        sermonLocalDataSourceImpl: SermonLocalDataSource
    ): SermonDataSource
}

