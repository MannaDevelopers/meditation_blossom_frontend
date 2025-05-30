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
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.facebook.react")
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21"
    id("com.google.gms.google-services")  // Google Services 플러그인 추가
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
        versionName = "0.0.1"  // 버전 업데이트
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
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // React Native
    implementation("com.facebook.react:react-android")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.12.0"))
    implementation("com.google.firebase:firebase-analytics")

    // Hermes
    if (project.extra["hermesEnabled"].toString().toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation(jscFlavor)
    }

    // Compose
    implementation(platform("androidx.compose:compose-bom:2025.04.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")

    // Glance (Widget)
    implementation("androidx.glance:glance:1.2.0-alpha01")
    implementation("androidx.glance:glance-appwidget:1.2.0-alpha01")
    implementation("androidx.glance:glance-material3:1.2.0-alpha01")
    debugImplementation("androidx.glance:glance-preview:1.2.0-alpha01")
    debugImplementation("androidx.glance:glance-appwidget-preview:1.2.0-alpha01")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Debug dependencies
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

apply(from = file("../../node_modules/react-native-vector-icons/fonts.gradle"))