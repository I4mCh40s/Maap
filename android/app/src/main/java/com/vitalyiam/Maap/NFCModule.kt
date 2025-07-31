// native-files/NFCModule.kt
package com.vitalyiam.Maap

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.TagLostException
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NFCModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var nfcAdapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(reactContext)
    private var scanPromise: Promise? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName() = "NFCModule"

    @ReactMethod
    fun scanTag(promise: Promise) {
        val activity = currentActivity
        if (nfcAdapter == null) {
            promise.reject("NFC_NOT_SUPPORTED", "NFC is not supported on this device.")
            return
        }
        if (!nfcAdapter!!.isEnabled) {
            promise.reject("NFC_NOT_ENABLED", "NFC is not enabled.")
            return
        }
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity.")
            return
        }

        this.scanPromise = promise

        val flags = NfcAdapter.FLAG_READER_NFC_A or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
        
        mainHandler.post {
             nfcAdapter?.enableReaderMode(activity, { tag ->
                // This callback runs on a background thread.
                // Convert tag ID bytes to a hex string for JavaScript
                val tagIdHex = tag.id.joinToString(":") { "%02X".format(it) }

                scanPromise?.resolve(tagIdHex)

                // Important: Disable reader mode back on the main thread after scan
                mainHandler.post {
                    nfcAdapter?.disableReaderMode(activity)
                }

             }, flags, null)
        }
    }
    
    // Add these two methods to satisfy the NativeEventEmitter contract, even though we are not using events anymore for scanning.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}