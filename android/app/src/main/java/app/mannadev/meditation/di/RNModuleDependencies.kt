package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.domain.usecase.ClearWidgetPreferenceUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplaySermonUseCase
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface RNModuleDependencies {
    fun getSaveDisplaySermonUseCase(): SaveDisplaySermonUseCase
    fun getClearWidgetPreferences(): ClearWidgetPreferenceUseCase
}

// Helper function to easily access the dependencies from a context
fun  getRNModuleDependencies(context: Context): RNModuleDependencies {
    val hiltEntryPoint = EntryPointAccessors.fromApplication(
        context.applicationContext, // Use application context
        RNModuleDependencies::class.java
    )
    return hiltEntryPoint
}