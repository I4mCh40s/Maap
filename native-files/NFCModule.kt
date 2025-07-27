// native-files/NFCModule.kt
package com.vitalyiam.Maap

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException

class NFCModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), NfcAdapter.ReaderCallback {

    private var nfcAdapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(reactContext)

    override fun getName() = "NFCModule"

    @ReactMethod
    fun startNfcListening() {
        val activity = currentActivity
        if (activity != null && nfcAdapter != null) {
            val flags = NfcAdapter.FLAG_READER_NFC_A or
                        NfcAdapter.FLAG_READER_NFC_B or
                        NfcAdapter.FLAG_READER_NFC_F or
                        NfcAdapter.FLAG_READER_NFC_V
            nfcAdapter?.enableReaderMode(activity, this, flags, null)
        }
    }

    @ReactMethod
    fun stopNfcListening() {
        val activity = currentActivity
        if (activity != null && nfcAdapter != null) {
            nfcAdapter?.disableReaderMode(activity)
        }
    }

    override fun onTagDiscovered(tag: Tag?) {
        val ndef = Ndef.get(tag)
        if (ndef != null) {
            try {
                ndef.connect()
                val ndefMessage = ndef.ndefMessage
                if (ndefMessage != null && ndefMessage.records.isNotEmpty()) {
                    val record = ndefMessage.records[0]
                    val payload = record.payload
                    if (payload.size > 3) {
                       val text = String(payload, 3, payload.size - 3, Charsets.UTF_8)
                       sendEvent("onNfcTagDiscovered", text)
                    }
                }
                ndef.close()
            } catch (e: IOException) {
                e.printStackTrace()
            }
        }
    }

    private fun sendEvent(eventName: String, params: String) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // --- THIS IS THE FIX ---
    // The presence of these two methods satisfies the NativeEventEmitter contract.
    // We don't need to put any code inside them for our simple module to work.

    @ReactMethod
    fun addListener(eventName: String) {
      // Required for new NativeEventEmitter syntax
    }

    @ReactMethod
    fun removeListeners(count: Int) {
      // Required for new NativeEventEmitter syntax
    }
    // --- END OF FIX ---
}