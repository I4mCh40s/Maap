// Path: android/app/src/main/java/com/vitalyiam/Maap/ar/TextRenderer.kt
package com.vitalyiam.Maap.ar

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.opengl.GLES20
import android.opengl.GLUtils
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

class TextRenderer {
    private var program = 0
    private var mvpMatrixHandle = 0
    private var positionHandle = 0
    private var texCoordHandle = 0
    private var textureUniformHandle = 0

    private lateinit var vertexBuffer: FloatBuffer
    private lateinit var texCoordBuffer: FloatBuffer

    private val textTextureCache = mutableMapOf<String, TextTexture>()
    data class TextTexture(val textureId: Int, val width: Int, val height: Int)

    fun createOnGlThread(context: Context) {
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER_CODE)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER_CODE)
        program = GLES20.glCreateProgram()
        GLES20.glAttachShader(program, vertexShader)
        GLES20.glAttachShader(program, fragmentShader)
        GLES20.glLinkProgram(program)

        mvpMatrixHandle = GLES20.glGetUniformLocation(program, "u_MvpMatrix")
        positionHandle = GLES20.glGetAttribLocation(program, "a_Position")
        texCoordHandle = GLES20.glGetAttribLocation(program, "a_TexCoord")
        textureUniformHandle = GLES20.glGetUniformLocation(program, "u_Texture")

        val quadVertices = floatArrayOf(-0.5f, -0.5f, 0.0f, 0.5f, -0.5f, 0.0f, -0.5f, 0.5f, 0.0f, 0.5f, 0.5f, 0.0f)
        vertexBuffer = ByteBuffer.allocateDirect(quadVertices.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(quadVertices).position(0) }
        
        // Corrected UV coordinates to fix mirroring
        val quadTexCoords = floatArrayOf(0.0f, 1.0f, 1.0f, 1.0f, 0.0f, 0.0f, 1.0f, 0.0f)
        texCoordBuffer = ByteBuffer.allocateDirect(quadTexCoords.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(quadTexCoords).position(0) }
    }

    fun draw(anchorMatrix: FloatArray, viewMatrix: FloatArray, projectionMatrix: FloatArray, cameraPosition: FloatArray, text: String) {
        val texture = textTextureCache.getOrPut(text) { createTextTexture(text) }
        
        val aspectRatio = if (texture.height > 0) texture.width.toFloat() / texture.height.toFloat() else 1.0f
        val scaleFactor = 0.3f
        
        val modelMatrix = FloatArray(16)
        
        val anchorPosition = floatArrayOf(anchorMatrix[12], anchorMatrix[13], anchorMatrix[14])
        val lookAtMatrix = FloatArray(16)
        android.opengl.Matrix.setLookAtM(lookAtMatrix, 0, 
            anchorPosition[0], anchorPosition[1], anchorPosition[2], 
            cameraPosition[0], cameraPosition[1], cameraPosition[2], 
            0f, 1f, 0f)
        
        val rotationMatrix = FloatArray(16)
        android.opengl.Matrix.invertM(rotationMatrix, 0, lookAtMatrix, 0)
        
        android.opengl.Matrix.setIdentityM(modelMatrix, 0)
        android.opengl.Matrix.translateM(modelMatrix, 0, anchorPosition[0], anchorPosition[1], anchorPosition[2])
        android.opengl.Matrix.multiplyMM(modelMatrix, 0, modelMatrix, 0, rotationMatrix, 0)
        android.opengl.Matrix.scaleM(modelMatrix, 0, scaleFactor * aspectRatio, scaleFactor, 1.0f)

        val modelViewMatrix = FloatArray(16)
        val modelViewProjectionMatrix = FloatArray(16)
        android.opengl.Matrix.multiplyMM(modelViewMatrix, 0, viewMatrix, 0, modelMatrix, 0)
        android.opengl.Matrix.multiplyMM(modelViewProjectionMatrix, 0, projectionMatrix, 0, modelViewMatrix, 0)
        
        GLES20.glUseProgram(program)

        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture.textureId)
        GLES20.glUniform1i(textureUniformHandle, 0)

        GLES20.glEnable(GLES20.GL_BLEND)
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)

        GLES20.glEnableVertexAttribArray(positionHandle)
        GLES20.glVertexAttribPointer(positionHandle, 3, GLES20.GL_FLOAT, false, 0, vertexBuffer)
        GLES20.glEnableVertexAttribArray(texCoordHandle)
        GLES20.glVertexAttribPointer(texCoordHandle, 2, GLES20.GL_FLOAT, false, 0, texCoordBuffer)

        GLES20.glUniformMatrix4fv(mvpMatrixHandle, 1, false, modelViewProjectionMatrix, 0)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

        GLES20.glDisableVertexAttribArray(positionHandle)
        GLES20.glDisableVertexAttribArray(texCoordHandle)
        GLES20.glDisable(GLES20.GL_BLEND)
    }

    private fun createTextTexture(text: String): TextTexture {
        val paint = Paint().apply {
            textSize = 64f // Increased text size for clarity
            color = Color.WHITE
            textAlign = Paint.Align.LEFT
            isAntiAlias = true
            setShadowLayer(5.0f, 0f, 0f, Color.BLACK) // Add a subtle drop shadow
        }
        val textWidth = paint.measureText(text)
        val textHeight = paint.fontMetrics.descent - paint.fontMetrics.ascent
        
        // Add padding around text
        val padding = 16
        val bitmap = Bitmap.createBitmap(textWidth.toInt() + padding * 2, textHeight.toInt() + padding * 2, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Fill with a semi-transparent background for better readability
        val bgPaint = Paint().apply{ color = Color.argb(128, 0, 0, 0) }
        canvas.drawRoundRect(0f, 0f, canvas.width.toFloat(), canvas.height.toFloat(), 20f, 20f, bgPaint)
        
        canvas.drawText(text, padding.toFloat(), -paint.fontMetrics.ascent + padding, paint)

        val textureId = IntArray(1)
        GLES20.glGenTextures(1, textureId, 0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId[0])
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
        bitmap.recycle()

        return TextTexture(textureId[0], bitmap.width, bitmap.height)
    }

    private fun loadShader(type: Int, shaderCode: String) = GLES20.glCreateShader(type).also { GLES20.glShaderSource(it, shaderCode); GLES20.glCompileShader(it) }

    companion object {
        private val VERTEX_SHADER_CODE = """ ... """ // Same as before
        private val FRAGMENT_SHADER_CODE = """ ... """ // Same as before
    }
}