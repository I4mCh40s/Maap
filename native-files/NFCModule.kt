// native-files/NFCModule.kt
package com.vitalyiam.Maap

import android.nfc.NfcAdapter
import android.nfc.Tag
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = NFCModule.NAME)
class NFCModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    private var nfcAdapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(reactContext)
    private var scanPromise: Promise? = null
    
    // Companion object for constants
    companion object {
        const val NAME = "NFCModule"
    }

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName() = NAME

    @ReactMethod
    fun scanTag(promise: Promise) {
        val activity = currentActivity
        if (nfcAdapter == null) {
            promise.reject("NFC_NOT_SUPPORTED", "NFC is not supported.")
            return
        }
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity not available.")
            return
        }
        
        // Prevent new scan if one is already in progress
        if (this.scanPromise != null) {
            promise.reject("SCAN_IN_PROGRESS", "A scan is already in progress.")
            return
        }
        this.scanPromise = promise

        val flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
        
        activity.runOnUiThread {
             nfcAdapter?.enableReaderMode(activity, { tag ->
                tag?.let {
                    val tagIdHex = it.id.joinToString(":") { "%02X".format(it) }
                    // Fulfill the promise and clear it to prevent multiple resolves
                    scanPromise?.resolve(tagIdHex)
                    scanPromise = null
                    
                    // Immediately disable reader mode on the main thread
                    activity.runOnUiThread {
                        nfcAdapter?.disableReaderMode(activity)
                    }
                }
             }, flags, null)
        }
    }

    private fun cancelScan(reason: String, message: String) {
        scanPromise?.reject(reason, message)
        scanPromise = null
        currentActivity?.let { activity ->
             activity.runOnUiThread {
                nfcAdapter?.disableReaderMode(activity)
            }
        }
    }

    override fun onHostResume() {
        // App is now in the foreground. No action needed for promises, 
        // but we would restart listening for event-based systems here.
    }

    override fun onHostPause() {
        // App is going to the background. 
        // This is CRITICAL to prevent crashes.
        cancelScan("APP_PAUSED", "NFC scan cancelled because the app went to the background.")
    }

    override fun onHostDestroy() {
        // App is being destroyed.
        cancelScan("APP_DESTROYED", "NFC scan cancelled because the app was destroyed.")
    }
    
    // Required for new NativeEventEmitter syntax, even if unused.
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}