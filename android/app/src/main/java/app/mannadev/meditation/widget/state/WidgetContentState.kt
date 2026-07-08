package app.mannadev.meditation.widget.state

sealed interface WidgetContentState<out T> {
    data object Loading : WidgetContentState<Nothing>
    data class Data<T>(val value: T) : WidgetContentState<T>
    data class NoDataYet(val hasAppEverLaunched: Boolean) : WidgetContentState<Nothing>
    data class Error(val throwable: Throwable) : WidgetContentState<Nothing>
}
