package app.mannadev.meditation.data

/** 위젯 디자인 저장 계층(SharedPreferences 키, 갤러리 배경 파일명)을 콘텐츠별로 분리하기 위한 타입. */
enum class WidgetContentType(val storageSuffix: String) {
    SERMON("sermon"),
    QT("qt"),
}
