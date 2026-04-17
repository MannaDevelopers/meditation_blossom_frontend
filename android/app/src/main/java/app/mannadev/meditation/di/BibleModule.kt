package app.mannadev.meditation.di

import androidx.annotation.Keep
import app.mannadev.meditation.data.bible.BibleDb
import app.mannadev.meditation.data.bible.BibleDbImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Keep
@Module
@InstallIn(SingletonComponent::class)
abstract class BibleModule {

    @Binds
    @Singleton
    abstract fun bindBibleDb(impl: BibleDbImpl): BibleDb
}
