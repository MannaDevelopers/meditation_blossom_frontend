@file:Suppress("unused")

package app.mannadev.meditation.di

import androidx.annotation.Keep
import app.mannadev.meditation.data.AppLaunchState
import app.mannadev.meditation.data.AppLaunchStateImpl
import app.mannadev.meditation.data.QtFirestoreDataSource
import app.mannadev.meditation.data.QtPrefsDataSource
import app.mannadev.meditation.data.QtPrefsSource
import app.mannadev.meditation.data.QtRemoteSource
import app.mannadev.meditation.data.QtRepositoryImpl
import app.mannadev.meditation.data.SermonFirestoreDataSource
import app.mannadev.meditation.data.SermonPrefsDataSource
import app.mannadev.meditation.data.SermonPrefsSource
import app.mannadev.meditation.data.SermonRemoteSource
import app.mannadev.meditation.data.SermonRepositoryImpl
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.WidgetUpdateNotifierImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Keep
@Module
@InstallIn(SingletonComponent::class) // Application-level dependencies
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindSermonRepository(
        sermonRepositoryImpl: SermonRepositoryImpl
    ): SermonRepository

    @Binds
    @Singleton
    abstract fun bindSermonPrefsSource(impl: SermonPrefsDataSource): SermonPrefsSource

    @Binds
    @Singleton
    abstract fun bindSermonRemoteSource(impl: SermonFirestoreDataSource): SermonRemoteSource

    @Binds
    @Singleton
    abstract fun bindAppLaunchState(impl: AppLaunchStateImpl): AppLaunchState

    @Binds
    @Singleton
    abstract fun bindWidgetUpdateNotifier(impl: WidgetUpdateNotifierImpl): WidgetUpdateNotifier

    @Binds
    @Singleton
    abstract fun bindQtRepository(qtRepositoryImpl: QtRepositoryImpl): QtRepository

    @Binds
    @Singleton
    abstract fun bindQtPrefsSource(impl: QtPrefsDataSource): QtPrefsSource

    @Binds
    @Singleton
    abstract fun bindQtRemoteSource(impl: QtFirestoreDataSource): QtRemoteSource
}
