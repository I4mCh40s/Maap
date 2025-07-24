// Path: android/app/src/main/java/com/vitalyiam/Maap/ar/ARActivity.kt

package com.vitalyiam.Maap.ar

import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.ar.core.*
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.vitalyiam.Maap.R
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class ARActivity : AppCompatActivity(), GLSurfaceView.Renderer {

    private val TAG = "ARActivity"
    private var session: Session? = null
    private lateinit var surfaceView: GLSurfaceView
    private var userRequestedInstall = true

    private val backgroundRenderer = BackgroundRenderer()
    private val displayRotationHelper by lazy { DisplayRotationHelper(this) }
    private val objectRenderer = ObjectRenderer()

    private var anchor: Anchor? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
                        session = Session(this)
                        val config = Config(session)
                        config.geospatialMode = Config.GeospatialMode.ENABLED
                        session?.configure(config)
                    }
                    ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                        userRequestedInstall = false
                        return
                    }
                }
            } catch (e: Exception) {
                exception = e; message = "Error creating AR session: ${e.javaClass.simpleName}"
            }
            if (message != null) { Log.e(TAG, "AR session creation failed", exception); Toast.makeText(this, message, Toast.LENGTH_LONG).show(); finish(); return }
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
        objectRenderer.createOnGlThread(this)
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
                val frame = currentSession.update(); val camera = frame.camera
                backgroundRenderer.draw(frame)
                
                val earth = currentSession.earth ?: return@let
                if (earth.trackingState == TrackingState.TRACKING) {
                    
                    if (anchor == null) {
                        val cameraPose = earth.cameraGeospatialPose
                        val altitude = cameraPose.altitude
                        // Place the test anchor roughly 10 meters north of the user
                        val latitude = cameraPose.latitude + 0.0001
                        val longitude = cameraPose.longitude
                        
                        Log.d(TAG, "Creating Geospatial Anchor at lat:$latitude, lon:$longitude")
                        anchor = earth.createAnchor(latitude, longitude, altitude, 0f, 0f, 0f, 1f)
                    }

                    anchor?.let {
                         if (it.trackingState == TrackingState.TRACKING) {
                            val projectionMatrix = FloatArray(16); camera.getProjectionMatrix(projectionMatrix, 0, 0.1f, 1000.0f)
                            val viewMatrix = FloatArray(16); camera.getViewMatrix(viewMatrix, 0)
                            val anchorMatrix = FloatArray(16); it.pose.toMatrix(anchorMatrix, 0)
                            objectRenderer.draw(anchorMatrix, viewMatrix, projectionMatrix)
                         }
                    }
                }
            } catch (t: Throwable) { Log.e(TAG, "Exception on DrawFrame", t) }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (!CameraPermissionHelper.hasCameraPermission(this)) {
            Toast.makeText(this, "Camera permission is needed to run this application", Toast.LENGTH_LONG).show()
            if (!CameraPermissionHelper.shouldShowRequestPermissionRationale(this)) {
                CameraPermissionHelper.launchPermissionSettings(this)
            }
            finish()
        }
    }
}