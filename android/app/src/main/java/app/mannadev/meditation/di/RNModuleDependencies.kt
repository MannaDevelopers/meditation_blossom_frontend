package app.mannadev.meditation.di

import android.content.Context
import app.mannadev.meditation.data.WidgetPrefsDataSource
import app.mannadev.meditation.domain.repository.QtRepository
import app.mannadev.meditation.domain.repository.SermonRepository
import app.mannadev.meditation.domain.repository.WidgetDesignRepository
import app.mannadev.meditation.model.BibleReferenceResolver
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface RNModuleDependencies {
    fun sermonRepository(): SermonRepository
    fun qtRepository(): QtRepository
    fun widgetDesignRepository(): WidgetDesignRepository
    fun getBibleReferenceResolver(): BibleReferenceResolver
    fun getWidgetPrefs(): WidgetPrefsDataSource
}

fun getRNModuleDependencies(context: Context): RNModuleDependencies {
    return EntryPointAccessors.fromApplication(
        context.applicationContext,
        RNModuleDependencies::class.java
    )
}
