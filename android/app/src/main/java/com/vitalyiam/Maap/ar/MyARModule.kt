// Path: android/app/src/main/java/com/vitalyiam/Maap/ar/MyARModule.kt

package com.vitalyiam.Maap.ar

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class MyARModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "MyARModule"

    @ReactMethod
    fun sayHello(name: String, promise: Promise) {
        promise.resolve("Hello, $name from your custom Kotlin module!")
    }

    @ReactMethod
    fun launchARActivity() {
        val currentActivity = reactApplicationContext.currentActivity
        if (currentActivity != null) {
            val intent = Intent(currentActivity, ARActivity::class.java)
            currentActivity.startActivity(intent)
        }
    }
}