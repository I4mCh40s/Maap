// Path: android/app/src/main/java/com/vitalyiam/Maap/ar/DisplayRotationHelper.kt
package com.vitalyiam.Maap.ar

import android.app.Activity
import android.hardware.display.DisplayManager
import android.view.Display
import android.view.WindowManager
import com.google.ar.core.Session

class DisplayRotationHelper(private val activity: Activity) : DisplayManager.DisplayListener {
    private var viewportChanged = false
    private var viewportWidth = 0
    private var viewportHeight = 0
    
    // THIS LINE IS NOW CORRECT
    private val display: Display by lazy { activity.getSystemService(WindowManager::class.java).defaultDisplay }

    fun onResume() {
        activity.getSystemService(DisplayManager::class.java).registerDisplayListener(this, null)
    }

    fun onPause() {
        activity.getSystemService(DisplayManager::class.java).unregisterDisplayListener(this)
    }

    fun onSurfaceChanged(width: Int, height: Int) {
        viewportWidth = width
        viewportHeight = height
        viewportChanged = true
    }

    fun updateSessionIfNeeded(session: Session) {
        if (viewportChanged) {
            val displayRotation = display.rotation
            session.setDisplayGeometry(displayRotation, viewportWidth, viewportHeight)
            viewportChanged = false
        }
    }
    
    override fun onDisplayAdded(displayId: Int) {}
    override fun onDisplayRemoved(displayId: Int) {}
    override fun onDisplayChanged(displayId: Int) {
        viewportChanged = true
    }
}