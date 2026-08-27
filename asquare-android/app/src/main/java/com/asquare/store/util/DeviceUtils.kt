package com.asquare.store.util

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.util.DisplayMetrics
import com.asquare.store.data.model.DeviceHardwareInfo

object DeviceUtils {

    fun getDeviceHardwareInfo(context: Context): DeviceHardwareInfo {
        val supportedAbis = Build.SUPPORTED_ABIS.toList()
        val primaryAbi = if (supportedAbis.isNotEmpty()) supportedAbis[0] else "unknown"

        val metrics = context.resources.displayMetrics
        val densityBucket = when (metrics.densityDpi) {
            DisplayMetrics.DENSITY_LOW -> "ldpi (120dpi)"
            DisplayMetrics.DENSITY_MEDIUM -> "mdpi (160dpi)"
            DisplayMetrics.DENSITY_HIGH -> "hdpi (240dpi)"
            DisplayMetrics.DENSITY_XHIGH -> "xhdpi (320dpi)"
            DisplayMetrics.DENSITY_XXHIGH -> "xxhdpi (480dpi)"
            DisplayMetrics.DENSITY_XXXHIGH -> "xxxhdpi (640dpi)"
            else -> "${metrics.densityDpi} dpi"
        }

        val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        actManager?.getMemoryInfo(memInfo)
        val ramGb = String.format("%.1f GB", memInfo.totalMem.toDouble() / (1024 * 1024 * 1024))

        return DeviceHardwareInfo(
            primaryAbi = primaryAbi,
            supportedAbis = supportedAbis,
            androidVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
            sdkInt = Build.VERSION.SDK_INT,
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
            manufacturer = Build.MANUFACTURER,
            screenDpi = metrics.densityDpi,
            screenDensityBucket = densityBucket,
            totalRamGb = ramGb
        )
    }

    fun isAppInstalled(context: Context, packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: Exception) {
            false
        }
    }
}
