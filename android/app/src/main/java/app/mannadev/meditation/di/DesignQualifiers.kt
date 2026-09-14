package app.mannadev.meditation.di

import javax.inject.Qualifier

/** 주일 말씀 위젯 디자인 저장소/저장소 소스를 가리키는 Hilt Qualifier. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class SermonDesign

/** QT(매일 만나) 위젯 디자인 저장소/저장소 소스를 가리키는 Hilt Qualifier. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class QtDesign
