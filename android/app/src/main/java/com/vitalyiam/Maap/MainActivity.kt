package com.vitalyiam.Maap

import android.os.Bundle; // ADD THIS IMPORT
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Maap"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [isNewArchitectureEnabled].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, DefaultNewArchitectureEntryPoint.fabricEnabled)

  // --- ADD THIS ENTIRE onCREATE METHOD ---
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
  // --- END OF ADDED BLOCK ---
}