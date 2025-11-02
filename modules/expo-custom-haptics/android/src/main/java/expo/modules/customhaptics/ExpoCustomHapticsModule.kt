package expo.modules.customhaptics

import android.content.Context
import android.os.Build
import android.os.Vibrator
import android.os.VibrationEffect
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoCustomHapticsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("React context lost")

  private val vibrator: Vibrator?
    get() = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

  override fun definition() = ModuleDefinition {
    Name("ExpoCustomHaptics")

    // vibrate(durationMs: number, amplitude: number)
    // duration: milliseconds (any positive number, e.g. 1-1000)
    // amplitude: 1-255 (1 = softest, 255 = max intensity)
    Function("vibrate") { durationMs: Int, amplitude: Int ->
      val vib = vibrator ?: return@Function

      if (!vib.hasVibrator()) {
        return@Function
      }

      // Clamp amplitude to valid range 1-255
      val clampedAmplitude = amplitude.coerceIn(1, 255)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Android 8.0+ - Use VibrationEffect with amplitude control
        val effect = VibrationEffect.createOneShot(durationMs.toLong(), clampedAmplitude)
        vib.vibrate(effect)
      } else {
        // Android 7.1 and below - No amplitude support, just duration
        @Suppress("DEPRECATION")
        vib.vibrate(durationMs.toLong())
      }
    }

    // Cancel any ongoing vibration
    Function("cancel") {
      vibrator?.cancel()
    }

    // Check if device has vibrator
    Function("hasVibrator") {
      vibrator?.hasVibrator() ?: false
    }
  }
}
