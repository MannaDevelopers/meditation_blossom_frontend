package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.data.WidgetPrefsDataSource
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetDependencies {
    fun sermonRepository(): SermonRepository
    fun qtRepository(): QtRepository
    fun getWidgetPrefs(): WidgetPrefsDataSource
}

fun getWidgetDependencies(context: Context): WidgetDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        WidgetDependencies::class.java
    )
}
