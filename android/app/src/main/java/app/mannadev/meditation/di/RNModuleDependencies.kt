package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.domain.usecase.ClearQtPreferenceUseCase
import app.mannadev.meditation.domain.usecase.ClearWidgetPreferenceUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplayQtUseCase
import app.mannadev.meditation.domain.usecase.SaveDisplaySermonUseCase
import app.mannadev.meditation.model.BibleReferenceResolver
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface RNModuleDependencies {
    fun getSaveDisplaySermonUseCase(): SaveDisplaySermonUseCase
    fun getClearWidgetPreferences(): ClearWidgetPreferenceUseCase
    fun getSaveDisplayQtUseCase(): SaveDisplayQtUseCase
    fun getClearQtPreferences(): ClearQtPreferenceUseCase
    fun getBibleReferenceResolver(): BibleReferenceResolver
}

fun getRNModuleDependencies(context: Context): RNModuleDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        RNModuleDependencies::class.java
    )
}
