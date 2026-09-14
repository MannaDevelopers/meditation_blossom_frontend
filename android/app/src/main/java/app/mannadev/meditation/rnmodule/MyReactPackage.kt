package app.mannadev.meditation.rnmodule

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class MyReactPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            WidgetUpdateModule.NAME -> WidgetUpdateModule(reactContext)
            NativeEventModule.NAME -> NativeEventModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            WidgetUpdateModule.NAME to ReactModuleInfo(
                name = WidgetUpdateModule.NAME,
                className = WidgetUpdateModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            ),
            NativeEventModule.NAME to ReactModuleInfo(
                name = NativeEventModule.NAME,
                className = NativeEventModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            ),
        )
    }
}
