// Path: android/app/src/main/java/com/vitalyiam/Maap/ar/ARActivity.kt
// FINAL, LOCAL ANCHOR, TEXT RENDERER VERSION
package com.vitalyiam.Maap.ar

import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.ar.core.*
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.vitalyiam.Maap.R
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

// This data class matches what our JavaScript will send
data class Shout(val id: String, val text: String, val position: FloatArray)
// This class will hold the live AR anchor and its associated text
data class ShoutAnchor(val anchor: Anchor, val shout: Shout)

class ARActivity : AppCompatActivity(), GLSurfaceView.Renderer {

    private val TAG = "ARActivity"
    private var session: Session? = null
    private lateinit var surfaceView: GLSurfaceView
    private var userRequestedInstall = true

    private val backgroundRenderer = BackgroundRenderer()
    private val displayRotationHelper by lazy { DisplayRotationHelper(this) }
    private val textRenderer = TextRenderer() // Our new TextRenderer

    // Lists to manage our AR objects
    private val shoutsToCreate = mutableListOf<Shout>()
    private val placedShouts = mutableListOf<ShoutAnchor>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val shoutsJson = intent.getStringExtra("shouts")
        if (shoutsJson != null) {
            Log.d(TAG, "Received shouts from JS: $shoutsJson")
            val type = object : TypeToken<List<Shout>>() {}.type
            try {
                val parsedShouts: List<Shout> = Gson().fromJson(shoutsJson, type)
                synchronized(shoutsToCreate) {
                    shoutsToCreate.addAll(parsedShouts)
                }
            } catch (e: Exception) { Log.e(TAG, "Failed to parse shouts JSON", e) }
        }

        setContentView(R.layout.activity_ar)
        surfaceView = findViewById(R.id.surfaceview)
        surfaceView.setPreserveEGLContextOnPause(true)
        surfaceView.setEGLContextClientVersion(2)
        surfaceView.setEGLConfigChooser(8, 8, 8, 8, 16, 0)
        surfaceView.setRenderer(this)
        surfaceView.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
    }

    override fun onResume() {
        super.onResume()

        if (!CameraPermissionHelper.hasCameraPermission(this)) {
            CameraPermissionHelper.requestCameraPermission(this)
            return
        }
        
        if (session == null) {
            var exception: Exception? = null; var message: String? = null
            try {
                when (ArCoreApk.getInstance().requestInstall(this, userRequestedInstall)) {
                    ArCoreApk.InstallStatus.INSTALLED -> {
                        // Create a standard AR session (no Geospatial config)
                        session = Session(this)
                    }
                    ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                        userRequestedInstall = false
                        return
                    }
                }
            } catch (e: Exception) {
                exception = e
                message = "An error occurred while creating AR session: ${e.javaClass.simpleName}"
            }
            if (message != null) {
                Log.e(TAG, "ARCore session creation failed", exception)
                Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                finish()
                return
            }
        }
        
        try {
            session?.resume()
        } catch (e: CameraNotAvailableException) {
            Log.e(TAG, "Camera not available on resume", e)
            finish()
            return
        }
        surfaceView.onResume()
        displayRotationHelper.onResume()
    }

    override fun onPause() {
        super.onPause()
        if (session != null) {
            displayRotationHelper.onPause()
            surfaceView.onPause()
            session?.pause()
        }
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0.1f, 0.1f, 0.1f, 1.0f)
        backgroundRenderer.createOnGlThread()
        // Initialize our text renderer
        textRenderer.createOnGlThread(this)
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        displayRotationHelper.onSurfaceChanged(width, height)
        GLES20.glViewport(0, 0, width, height)
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        session?.let { currentSession ->
            displayRotationHelper.updateSessionIfNeeded(currentSession)
            try {
                currentSession.setCameraTextureName(backgroundRenderer.textureId)
                val frame = currentSession.update()
                val camera = frame.camera
                
                backgroundRenderer.draw(frame)
                
                if (camera.trackingState == TrackingState.PAUSED) return@let
                
                // Create anchors for any new shouts
                synchronized(shoutsToCreate) {
                    shoutsToCreate.forEach { shout ->
                       val pose = Pose(shout.position, floatArrayOf(0f, 0f, 0f, 1f))
                       // Create a local anchor relative to the user's starting position
                       val anchor = currentSession.createAnchor(camera.pose.compose(pose).extractTranslation())
                       placedShouts.add(ShoutAnchor(anchor, shout))
                    }
                    shoutsToCreate.clear()
                }

                val projectionMatrix = FloatArray(16)
                camera.getProjectionMatrix(projectionMatrix, 0, 0.1f, 100.0f) // Can use shorter view distance
                val viewMatrix = FloatArray(16)
                camera.getViewMatrix(viewMatrix, 0)
                val cameraPosition = floatArrayOf(camera.pose.tx(), camera.pose.ty(), camera.pose.tz())
                
                // Draw all of our placed shouts
                placedShouts.forEach { shoutAnchor ->
                    if (shoutAnchor.anchor.trackingState == TrackingState.TRACKING) {
                        val anchorMatrix = FloatArray(16)
                        shoutAnchor.anchor.pose.toMatrix(anchorMatrix, 0)
                        textRenderer.draw(anchorMatrix, viewMatrix, projectionMatrix, cameraPosition, shoutAnchor.shout.text)
                    }
                }
            } catch (t: Throwable) {
                Log.e(TAG, "Exception on DrawFrame", t)
            }
        }
    }
    
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (!CameraPermissionHelper.hasCameraPermission(this)) {
            Toast.makeText(this, "Camera permission is needed for this feature", Toast.LENGTH_LONG).show()
            finish()
        }
    }
}