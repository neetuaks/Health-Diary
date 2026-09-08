// MLKitOCR.kt
// Template Android native module for on-device OCR using ML Kit.
// Add this to your Android project's native modules and register it.

package com.healthdiary.ocr

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class MLKitOCRModule(val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String {
    return "MLKitOCR"
  }

  @ReactMethod
  fun process(uri: String, promise: Promise) {
    try {
      val context = reactContext.currentActivity ?: reactContext.applicationContext
      val inputImage = InputImage.fromFilePath(context, Uri.parse(uri))
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer.process(inputImage)
        .addOnSuccessListener { visionText ->
          // Build a simple response. Production: parse into structured fields.
          val fullText = visionText.text
          val res = mapOf("parameterType" to "unknown", "values" to mapOf<String,String>(), "confidence" to 0.0, "rawText" to fullText)
          promise.resolve(res)
        }
        .addOnFailureListener { e ->
          promise.reject("mlkit_error", e)
        }
    } catch (e: Exception) {
      promise.reject("mlkit_error", e)
    }
  }

}
