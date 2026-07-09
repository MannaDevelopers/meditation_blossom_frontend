package app.mannadev.meditation.widget

interface WidgetUpdateNotifier {
    suspend fun notifySermonChanged()
    suspend fun notifyQtChanged()
}
