import java.io.FileInputStream
import java.util.Properties

// secrets.properties 파일 로드 함수
fun loadSecrets(): Properties? {
    val secretsFile = rootProject.file("app/secrets.properties")
    if (!secretsFile.exists()) {
        if (gradle.startParameter.taskNames.any { it.contains("Release") || it.contains("release") }) {
            throw RuntimeException("secrets.properties file not found. Release build requires secrets.properties file.")
        }
        return null
    }
    val secrets = Properties()
    secrets.load(FileInputStream(secretsFile))
    return secrets
}

val secrets = loadSecrets()

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.firebase.crashlytics)
    id("com.facebook.react")
}

react {
    // Autolinking
    autolinkLibrariesWithApp()
}

/**
 * Set this to true to Run Proguard on Release builds to minify the Java bytecode.
 */
val enableProguardInReleaseBuilds = false

/**
 * The preferred build flavor of JavaScriptCore (JSC)
 */
val jscFlavor = "org.webkit:android-jsc:+"

android {
    ndkVersion = rootProject.extra["ndkVersion"].toString()
    compileSdk = rootProject.extra["compileSdkVersion"].toString().toInt()

    namespace = "app.mannadev.meditation"

    defaultConfig {
        applicationId = "app.mannadev.meditation"
        minSdk = rootProject.extra["minSdkVersion"].toString().toInt()
        targetSdk = rootProject.extra["targetSdkVersion"].toString().toInt()
        versionCode = 1
        versionName = "0.4.2"  // 버전 업데이트

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }

        // release signing 설정 추가
        create("release") {
            if (gradle.startParameter.taskNames.any { it.contains("Release") || it.contains("release") }) {
                storeFile = file(secrets?.getProperty("STORE_FILE") ?: "debug.keystore")
                storePassword = secrets?.getProperty("STORE_PASSWORD") ?: "android"
                keyAlias = secrets?.getProperty("KEY_ALIAS") ?: "androiddebugkey"
                keyPassword = secrets?.getProperty("KEY_PASSWORD") ?: "android"
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
            applicationIdSuffix = ".debug"
        }
        release {
            signingConfig = signingConfigs.getByName("release")  // release signing 사용
            isMinifyEnabled = enableProguardInReleaseBuilds
            proguardFiles(
                getDefaultProguardFile("proguard-android.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.6.0"
    }

    kotlinOptions {
        jvmTarget = "17"
    }
    packaging{
        jniLibs{
            useLegacyPackaging = false // Ensures libraries are page-aligned and uncompressed
        }
    }
}

dependencies {
    // React Native
    implementation(libs.react.android)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.crashlytics)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.messaging)

    // Hermes
    if (project.extra["hermesEnabled"].toString().toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation(jscFlavor)
    }

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.material3)
    debugImplementation(libs.androidx.ui.tooling.preview)

    // Glance (Widget)
    implementation(libs.androidx.glance)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)
    debugImplementation(libs.androidx.glance.preview)
    debugImplementation(libs.androidx.glance.appwidget.preview)

    // Kotlinx
    implementation(libs.kotlinx.serialization.json)

    // WorkManager
    implementation(libs.androidx.work.runtime.ktx)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler) // Use ksp instead of kapt

    implementation(libs.timber) // Or the latest version

    // Debug dependencies
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}

apply(from = file("../../node_modules/react-native-vector-icons/fonts.gradle"))