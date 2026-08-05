package app.mannadev.meditation.ui.widget

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.layout.size
import app.mannadev.meditation.R

@Composable
fun YoutubeMarker(modifier: GlanceModifier = GlanceModifier) {
    Image(
        provider = ImageProvider(R.drawable.ic_youtube_widget),
        contentDescription = null,
        modifier = modifier.size(18.dp),
    )
}
