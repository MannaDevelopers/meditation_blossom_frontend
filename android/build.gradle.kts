buildscript {
    extra.apply {
        set("minSdkVersion", 28)
        set("compileSdkVersion", 36)
        set("targetSdkVersion", 36)
        set("ndkVersion", "28.1.13356709")
    }

    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath(libs.gradle)
        classpath(libs.react.native.gradle.plugin)
        classpath(libs.kotlin.gradle.plugin)
        classpath(libs.google.services)
        classpath(libs.firebase.crashlytics.gradle.plugin)
    }
}

plugins {
    id("com.facebook.react.rootproject")
} 