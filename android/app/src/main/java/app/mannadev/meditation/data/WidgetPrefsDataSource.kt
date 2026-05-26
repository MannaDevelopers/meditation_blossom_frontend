package app.mannadev.meditation.data

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WidgetPrefsDataSource @Inject constructor(
    @ApplicationContext context: Context,
) {
    companion object {
        private const val PREFS_NAME = "widget_prefs"
        private const val KEY_YOUTUBE_LINK_ENABLED = "youtube_link_enabled"
        private const val DEFAULT_ENABLED = false
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun isEnabled(): Boolean = prefs.getBoolean(KEY_YOUTUBE_LINK_ENABLED, DEFAULT_ENABLED)

    suspend fun setEnabled(enabled: Boolean) = withContext(Dispatchers.IO) {
        prefs.edit { putBoolean(KEY_YOUTUBE_LINK_ENABLED, enabled) }
    }
}
