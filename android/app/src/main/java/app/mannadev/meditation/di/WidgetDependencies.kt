package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.usecase.GetDisplaySermonUseCase
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetDependencies {
    fun getDisplaySermonUseCase(): GetDisplaySermonUseCase
}

// Helper function to easily access the dependencies from a context
fun getWidgetDependencies(context: Context): WidgetDependencies {
    val hiltEntryPoint = EntryPointAccessors.fromApplication(
        context.applicationContext, // Use application context
        WidgetDependencies::class.java
    )
    return hiltEntryPoint
}