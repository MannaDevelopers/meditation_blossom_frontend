@file:Suppress("unused")

package app.mannadev.meditation.di

import androidx.annotation.Keep
import app.mannadev.meditation.data.SermonDataSource
import app.mannadev.meditation.data.SermonFirestoreDataSource
import app.mannadev.meditation.data.SermonLocalDataSource
import app.mannadev.meditation.data.SermonPrefsDataSource
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.SermonRepository
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


    @Binds
    @Singleton
    @LocalDataSource
    abstract fun bindSermonLocalDataSource(
        impl: SermonLocalDataSource
    ): SermonDataSource

    @Binds
    @Singleton
    @RemoteDataSource
    abstract fun bindSermonFirestoreDataSource(
        impl: SermonFirestoreDataSource
    ): SermonDataSource

    @Binds
    @Singleton
    @PrefsDataSource
    abstract fun bindSermonPrefsDataSource(
        impl: SermonPrefsDataSource
    ): SermonDataSource
}

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class LocalDataSource

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class RemoteDataSource // Or FirestoreDataSource if you prefer more specificity

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class PrefsDataSource

/**
 * Entry point for accessing DataSources from non-Hilt classes.
 * Used in [app.mannadev.meditation.service.RefreshActionCallback]
 */
interface DataSourceEntryPoint {
    @LocalDataSource
    fun getSermonLocalDataSource(): SermonDataSource
}
