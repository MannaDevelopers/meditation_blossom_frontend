@file:Suppress("unused")

package app.mannadev.meditation.di

import androidx.annotation.Keep
import app.mannadev.meditation.data.EditableSermonDataSource
import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.data.SermonFirestoreDataSource
import app.mannadev.meditation.data.SermonPrefsDataSource
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.repository.SermonRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton

@Keep
@Module
@InstallIn(SingletonComponent::class) // Application-level dependencies
abstract class RepositoryModule {

    @Binds
    @Singleton // Binds the implementation to the interface, and makes it a singleton
    abstract fun bindSermonRepository(
        sermonRepositoryImpl: SermonRepositoryImpl
    ): SermonRepository
}
