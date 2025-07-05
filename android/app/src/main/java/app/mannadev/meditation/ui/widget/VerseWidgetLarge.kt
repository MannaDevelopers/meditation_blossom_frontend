package app.mannadev.meditation.ui.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import app.mannadev.meditation.MainActivity
import app.mannadev.meditation.R
import app.mannadev.meditation.di.getWidgetDependencies
import app.mannadev.meditation.model.Sermon
import app.mannadev.meditation.ui.widget.theme.Typography
import app.mannadev.meditation.utils.getPreviousOrCurrentSaturday
import java.time.LocalDate
import java.time.LocalDateTime

class VerseWidgetLarge : GlanceAppWidget(
    errorUiLayout = R.layout.verse_widget_large_error,
) {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val widgetDependencies = getWidgetDependencies(context)
        val getDisplaySermonUseCase = widgetDependencies.getDisplaySermonUseCase()
        val verse = getDisplaySermonUseCase(LocalDateTime.now())
            ?: throw IllegalStateException("Verse data is null")

        provideContent {
            val prefs = currentState<Preferences>()
            val title = prefs[VerseWidgetDataKeys.title]
            val bookName = prefs[VerseWidgetDataKeys.bookName]
            val verses = prefs[VerseWidgetDataKeys.verses]
            val date = prefs[VerseWidgetDataKeys.date]
            LaunchedEffect(date) {
                val targetDate = LocalDate.now().getPreviousOrCurrentSaturday()
                if (date == null || LocalDate.parse(date) < targetDate) {
                    // If the date is null or in the past, update the widget with the latest sermon
                    actionRunCallback<RefreshActionCallback>(
                        parameters = actionParametersOf(
                            
                        )
                    )
                }
            }
            VerseWidgetLargeContent(
                verse.title,
                verse.bookName,
                Verses(verse.verses.joinToString("\n"))
            )
        }
    }
}

private object VerseLargeWidgetDimens {
    val appBarVerticalPadding = 24.dp
    val horizontalPadding = 24.dp
    val bottomPadding = 24.dp
    val verseContentBottomSpacer = 16.dp
    val bookNameTopSpacer = 12.dp
}

@Immutable
class Verses(
    val value: String
) {
    val list: List<String> = value.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
}

/**
 * Composable function that defines the content of the large verse widget.
 * It displays the verse title, content (scrollable if it exceeds the available space), and book name.
 * The widget has a gradient background and is clickable to open the MainActivity.
 *
 * @param sermon The [Sermon] object containing the data to be displayed.
 */
@Composable
private fun VerseWidgetLargeContent(
    title: String,
    bookName: String,
    verses: Verses
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>())
            .appWidgetBackground()
            .xmlGradientBackground(),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.Top
    ) {
        // Title Section
        Column(
            modifier = GlanceModifier
                .padding(
                    horizontal = VerseLargeWidgetDimens.horizontalPadding,
                    vertical = VerseLargeWidgetDimens.appBarVerticalPadding
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = Typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 2
            )
        }
        // Content and Book Name Section
        LazyColumn(
            GlanceModifier.fillMaxWidth()
                .defaultWeight()
        ) {
            items(verses.list) { verse ->
                Text(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(horizontal = VerseLargeWidgetDimens.horizontalPadding)
                        .clickable(actionStartActivity<MainActivity>()),
                    text = verse,
                    style = Typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
            }
            item {
                Spacer(GlanceModifier.height(VerseLargeWidgetDimens.verseContentBottomSpacer)) // 마지막 항목 아래 여백
            }
        }
        Text(
            modifier = GlanceModifier.padding(
                start = VerseLargeWidgetDimens.horizontalPadding,
                top = VerseLargeWidgetDimens.bookNameTopSpacer,
                bottom = VerseLargeWidgetDimens.bottomPadding
            ),
            text = bookName,
            style = Typography.labelMedium
        )
    }
}
