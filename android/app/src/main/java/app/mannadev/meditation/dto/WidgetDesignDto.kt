package app.mannadev.meditation.dto

import kotlinx.serialization.Serializable

/**
 * JS WidgetDesign(src/types/WidgetDesign.ts)과 1:1로 대응하는 브릿지 전송 DTO.
 * background.value는 type="color"면 hex(또는 "gradient-default"), type="gallery"면 이미지 경로다.
 * 갤러리 이미지는 [WidgetDesignPrefsDataSource]가 저장 시점에 앱 내부 저장소의 고정 경로로
 * 치환하므로, 여기 저장된 값은 항상 앱이 접근 가능한 최신 경로를 가리킨다.
 */
@Serializable
data class WidgetDesignDto(
    val text: WidgetTextDesignDto,
    val background: WidgetBackgroundDesignDto,
)

@Serializable
data class WidgetTextDesignDto(
    val align: String, // "left" | "center" | "right"
    val color: String, // hex, e.g. "#000000"
    val size: Int, // 16 | 20 | 24 | 28
    val weight: String, // "regular" | "bold" | "extrabold"
)

@Serializable
data class WidgetBackgroundDesignDto(
    val type: String, // "color" | "gallery"
    val value: String,
    val imageTransform: WidgetImageTransformDto? = null,
)

@Serializable
data class WidgetImageTransformDto(
    val zoom: Double,
    val focalX: Double,
    val focalY: Double,
)
