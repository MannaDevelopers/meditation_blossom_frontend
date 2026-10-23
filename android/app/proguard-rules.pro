# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:
# --- ISSUE-337: Release R8 활성화에 따른 keep 규칙 ---
# RN / Firebase / Hilt / kotlinx-serialization / Glance / WorkManager 라이브러리는
# 자체 consumer rules를 제공한다. 아래는 앱 코드 중 이름/리플렉션 접근이 필요한 부분만 유지한다.

# 스택트레이스 복원용 (Crashlytics mapping 업로드와 함께 사용)
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# RN 네이티브 모듈: JS에서 이름(MyEventModule / WidgetUpdateModule)으로 접근하고
# MyReactPackage가 ReactModuleInfo의 className 문자열로 참조한다.
-keep class app.mannadev.meditation.rnmodule.** { *; }

# 매니페스트에 선언된 위젯 receiver/서비스/액티비티 (AGP가 자동 keep하지만 Glance 위젯 클래스는 명시)
-keep class app.mannadev.meditation.widget.** { *; }
-keep class app.mannadev.meditation.service.** { *; }

# kotlinx-serialization: DTO 및 @Serializable 클래스의 생성된 serializer 유지
-keepclassmembers @kotlinx.serialization.Serializable class app.mannadev.meditation.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
    *** $serializer;
}
-keep class app.mannadev.meditation.**$$serializer { *; }
-keep class app.mannadev.meditation.dto.** { *; }

# Hilt EntryPoint 인터페이스 (EntryPointAccessors가 클래스로 조회)
-keep @dagger.hilt.EntryPoint interface * { *; }
