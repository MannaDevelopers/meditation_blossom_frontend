package app.mannadev.meditation.di

import app.mannadev.meditation.domain.GetDisplaySermonUseCase
import app.mannadev.meditation.domain.SermonRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object UseCaseModule { // Use @Provides for classes you don't own or for concrete classes directly

    @Provides // No @Singleton here means a new instance of GetDisplaySermonUseCase is provided each time
    // Add @Singleton if you want it to be a singleton (if it's stateless, it's often fine either way)
    fun provideGetDisplaySermonUseCase(sermonRepository: SermonRepository): GetDisplaySermonUseCase {
        return GetDisplaySermonUseCase(sermonRepository)
    }
}