package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.domain.usecase.GetDisplayQtUseCase
import app.mannadev.meditation.domain.usecase.GetDisplaySermonUseCase
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetDependencies {
    fun getDisplaySermonUseCase(): GetDisplaySermonUseCase
    fun getDisplayQtUseCase(): GetDisplayQtUseCase
}

fun getWidgetDependencies(context: Context): WidgetDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        WidgetDependencies::class.java
    )
}
