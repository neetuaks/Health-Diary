// MLKitOCR.kt
// Template Android native module for on-device OCR using ML Kit.
// Add this to your Android project's native modules and register it.

package com.healthdiary.ocr

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
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
          val fullText = visionText.text ?: ""
          val map: WritableMap = Arguments.createMap()
          val values = Arguments.createMap()

          // Heuristic parsing for BP and Glucose values
          var parameterType = "unknown"
          var confidenceScore = 0.0

          // Blood pressure patterns: 120/80 or BP 120/80
          val bpRegex = Regex("\\b(?:bp[:\\s]*)?(\\d{2,3})\\s*[\\/\\-\\\\]\\s*(\\d{2,3})\\b", RegexOption.IGNORE_CASE)
          val bpMatch = bpRegex.find(fullText)
          if (bpMatch != null) {
            parameterType = "bp"
            val systolic = bpMatch.groupValues[1]
            val diastolic = bpMatch.groupValues[2]
            values.putString("systolic", systolic)
            values.putString("diastolic", diastolic)
            if (fullText.contains("mmhg", ignoreCase = true)) values.putString("unit", "mmHg")
            confidenceScore = if (fullText.contains("bp", ignoreCase = true)) 0.95 else 0.85
          }

          // Glucose patterns: number with mg/dL or mmol/L, or keywords glucose/bg
          if (parameterType == "unknown") {
            val mmolRegex = Regex("\\b(?:glucose|bg|blood glucose|sugar)[:\\s]*?(\\d+(?:[.,]\\d+))\\s*(?:mmol\\/?l|mmol)\\b", RegexOption.IGNORE_CASE)
            val mgRegex = Regex("\\b(?:glucose|bg|blood glucose|sugar)[:\\s]*?(\\d{2,3})(?:\\s*(?:mg\\/?dL|mg))?\\b", RegexOption.IGNORE_CASE)
            val mgInline = Regex("\\b(\\d{2,3})\\s*(?:mg\\/?dL|mg)\\b", RegexOption.IGNORE_CASE)

            val mMmol = mmolRegex.find(fullText)
            val mMg = mgRegex.find(fullText) ?: mgInline.find(fullText)

            if (mMg != null) {
              parameterType = "glucose"
              values.putString("value", mMg.groupValues[1])
              values.putString("unit", "mg/dL")
              confidenceScore = 0.9
            } else if (mMmol != null) {
              parameterType = "glucose"
              // normalize comma decimal
              val v = mMmol.groupValues[1].replace(',', '.')
              values.putString("value", v)
              values.putString("unit", "mmol/L")
              confidenceScore = 0.9
            }
          }

          map.putString("parameterType", parameterType)
          map.putDouble("confidence", confidenceScore)
          map.putString("rawText", fullText)
          map.putMap("values", values)
          promise.resolve(map)
        }
        .addOnFailureListener { e ->
          promise.reject("mlkit_error", e)
        }
    } catch (e: Exception) {
      promise.reject("mlkit_error", e)
    }
  }

}
