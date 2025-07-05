package app.mannadev.meditation.ui.widget

import androidx.datastore.preferences.core.stringPreferencesKey

object VerseWidgetDataKeys {
    val date = stringPreferencesKey("date")
    val title = stringPreferencesKey("title")
    val bookName = stringPreferencesKey("book_name")
    val verses = stringPreferencesKey("verses")

    //SUCCESS, LOADING, ERROR
    val state = stringPreferencesKey("state")
}