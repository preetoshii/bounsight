package com.preetoshi.bounsight

import android.content.Context
import android.os.Build
import android.os.Vibrator
import android.os.VibrationEffect
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CustomHapticsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "CustomHaptics"
  }

  @ReactMethod
  fun vibrate(durationMs: Int, amplitude: Int) {
    val vibrator = reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

    if (vibrator == null || !vibrator.hasVibrator()) {
      return
    }

    // Skip vibration if duration is 0 or negative (disabled in config)
    if (durationMs <= 0) {
      return
    }

    // Clamp amplitude to valid range 1-255
    val clampedAmplitude = amplitude.coerceIn(1, 255)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Android 8.0+ - Use VibrationEffect with amplitude control
      val effect = VibrationEffect.createOneShot(durationMs.toLong(), clampedAmplitude)
      vibrator.vibrate(effect)
    } else {
      // Android 7.1 and below - No amplitude support, just duration
      @Suppress("DEPRECATION")
      vibrator.vibrate(durationMs.toLong())
    }
  }

  @ReactMethod
  fun cancel() {
    val vibrator = reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    vibrator?.cancel()
  }
}
