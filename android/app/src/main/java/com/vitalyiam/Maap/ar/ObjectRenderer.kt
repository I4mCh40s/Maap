// Path: android/app/src/main/java/com/vitalyiam/Maap/ar/ObjectRenderer.kt

package com.vitalyiam.Maap.ar

import android.content.Context
import android.opengl.GLES20
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.ShortBuffer

class ObjectRenderer {

    private val modelViewProjectionMatrix = FloatArray(16)
    private var program = 0
    private var positionHandle = 0
    private var colorHandle = 0
    private var modelViewProjectionMatrixHandle = 0

    private lateinit var vertexBuffer: FloatBuffer
    private lateinit var indexBuffer: ShortBuffer

    fun createOnGlThread(context: Context) {
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER_CODE)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER_CODE)
        program = GLES20.glCreateProgram()
        GLES20.glAttachShader(program, vertexShader)
        GLES20.glAttachShader(program, fragmentShader)
        GLES20.glLinkProgram(program)
        GLES20.glUseProgram(program)

        positionHandle = GLES20.glGetAttribLocation(program, "a_Position")
        colorHandle = GLES20.glGetUniformLocation(program, "u_Color")
        modelViewProjectionMatrixHandle = GLES20.glGetUniformLocation(program, "u_ModelViewProjection")

        // A simple white cube's vertices and the order to draw them
        val CUBE_COORDS = floatArrayOf(
            -0.1f, -0.1f, -0.1f, 0.1f, -0.1f, -0.1f, 0.1f, 0.1f, -0.1f, -0.1f, 0.1f, -0.1f,
            -0.1f, -0.1f, 0.1f, 0.1f, -0.1f, 0.1f, 0.1f, 0.1f, 0.1f, -0.1f, 0.1f, 0.1f
        )
        val CUBE_INDICES = shortArrayOf(
            0, 1, 2, 0, 2, 3, // Front face
            4, 5, 6, 4, 6, 7, // Back face
            0, 3, 7, 0, 7, 4, // Left face
            1, 2, 6, 1, 6, 5, // Right face
            0, 1, 5, 0, 5, 4, // Bottom face
            3, 2, 6, 3, 6, 7  // Top face
        )

        // Put the vertex and index data into buffers for OpenGL
        vertexBuffer = ByteBuffer.allocateDirect(CUBE_COORDS.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(CUBE_COORDS).position(0) }
        indexBuffer = ByteBuffer.allocateDirect(CUBE_INDICES.size * 2).order(ByteOrder.nativeOrder()).asShortBuffer().apply { put(CUBE_INDICES).position(0) }
    }

    fun draw(anchorMatrix: FloatArray, cameraView: FloatArray, cameraProjection: FloatArray) {
        // Calculate the final transformation matrix
        val modelViewMatrix = FloatArray(16)
        android.opengl.Matrix.multiplyMM(modelViewMatrix, 0, cameraView, 0, anchorMatrix, 0)
        android.opengl.Matrix.multiplyMM(modelViewProjectionMatrix, 0, cameraProjection, 0, modelViewMatrix, 0)

        GLES20.glUseProgram(program)
        
        // Pass the matrix to the shader
        GLES20.glUniformMatrix4fv(modelViewProjectionMatrixHandle, 1, false, modelViewProjectionMatrix, 0)

        // Set the color for the cube (RGBA - white)
        GLES20.glUniform4fv(colorHandle, 1, floatArrayOf(1.0f, 1.0f, 1.0f, 1.0f), 0) 

        // Draw the cube
        vertexBuffer.position(0)
        GLES20.glVertexAttribPointer(positionHandle, 3, GLES20.GL_FLOAT, false, 0, vertexBuffer)
        GLES20.glEnableVertexAttribArray(positionHandle)

        indexBuffer.position(0)
        GLES20.glDrawElements(GLES20.GL_TRIANGLES, 36, GLES20.GL_UNSIGNED_SHORT, indexBuffer)
        
        GLES20.glDisableVertexAttribArray(positionHandle)
    }

    private fun loadShader(type: Int, shaderCode: String): Int {
        return GLES20.glCreateShader(type).also { shader ->
            GLES20.glShaderSource(shader, shaderCode)
            GLES20.glCompileShader(shader)
        }
    }

    companion object {
        private const val VERTEX_SHADER_CODE = """
            uniform mat4 u_ModelViewProjection;
            attribute vec4 a_Position;
            void main() {
                gl_Position = u_ModelViewProjection * a_Position;
            }
        """

        private const val FRAGMENT_SHADER_CODE = """
            precision mediump float;
            uniform vec4 u_Color;
            void main() {
                gl_FragColor = u_Color;
            }
        """
    }
}