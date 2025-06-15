buildscript {
    extra.apply {
        set("minSdkVersion", 28)
        set("compileSdkVersion", 35)
        set("targetSdkVersion", 35)
        set("ndkVersion", "28.1.13356709")
    }

    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath("com.android.tools.build:gradle:8.8.0")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21")
        classpath("com.google.gms:google-services:4.4.2")
    }
}

plugins {
    id("com.facebook.react.rootproject")
} 