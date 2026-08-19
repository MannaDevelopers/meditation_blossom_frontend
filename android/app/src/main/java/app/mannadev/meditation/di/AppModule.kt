@file:Suppress("unused")

package app.mannadev.meditation.di

import android.content.Context
import androidx.annotation.Keep
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
import app.mannadev.meditation.data.WidgetContentType
import app.mannadev.meditation.data.WidgetDesignPrefsDataSource
import app.mannadev.meditation.data.WidgetDesignPrefsSource
import app.mannadev.meditation.data.WidgetDesignRepositoryImpl
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.domain.repository.WidgetDesignRepository
import app.mannadev.meditation.widget.WidgetUpdateNotifier
import app.mannadev.meditation.widget.WidgetUpdateNotifierImpl
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
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

    companion object {
        // WidgetDesignPrefsDataSource/WidgetDesignRepositoryImpl는 주일 말씀/QT가 완전히 동일한
        // 비트맵 다운샘플링·JSON 인코딩 로직을 공유하므로 클래스를 복제하지 않고, 콘텐츠 타입
        // 파라미터만 다르게 준 두 인스턴스를 Qualifier로 구분해 바인딩한다([ISSUE-236]).
        @Provides
        @Singleton
        @SermonDesign
        fun provideSermonWidgetDesignPrefsSource(
            @ApplicationContext context: Context,
        ): WidgetDesignPrefsSource = WidgetDesignPrefsDataSource(context, WidgetContentType.SERMON)

        @Provides
        @Singleton
        @QtDesign
        fun provideQtWidgetDesignPrefsSource(
            @ApplicationContext context: Context,
        ): WidgetDesignPrefsSource = WidgetDesignPrefsDataSource(context, WidgetContentType.QT)

        @Provides
        @Singleton
        @SermonDesign
        fun provideSermonWidgetDesignRepository(
            @SermonDesign prefsSource: WidgetDesignPrefsSource,
            widgetUpdateNotifier: WidgetUpdateNotifier,
        ): WidgetDesignRepository =
            WidgetDesignRepositoryImpl(prefsSource) { widgetUpdateNotifier.notifySermonDesignChanged() }

        @Provides
        @Singleton
        @QtDesign
        fun provideQtWidgetDesignRepository(
            @QtDesign prefsSource: WidgetDesignPrefsSource,
            widgetUpdateNotifier: WidgetUpdateNotifier,
        ): WidgetDesignRepository =
            WidgetDesignRepositoryImpl(prefsSource) { widgetUpdateNotifier.notifyQtDesignChanged() }
    }
}
