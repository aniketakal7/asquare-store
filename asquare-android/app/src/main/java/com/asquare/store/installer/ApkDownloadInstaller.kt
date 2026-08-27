package com.asquare.store.installer

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.FileProvider
import com.asquare.store.ASquareApplication
import com.asquare.store.data.api.ASquareApiClient
import com.asquare.store.data.model.AppItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

object ApkDownloadInstaller {

    interface DownloadCallback {
        fun onProgress(percentage: Int)
        fun onSuccess(apkFile: File)
        fun onError(errorMsg: String)
    }

    suspend fun downloadAndInstall(
        activity: Activity,
        appItem: AppItem,
        callback: DownloadCallback
    ) {
        withContext(Dispatchers.IO) {
            try {
                val service = ASquareApiClient.getService()
                val response = try {
                    val res = service.downloadApk(appItem.id)
                    if (res.isSuccessful && res.body() != null) res else null
                } catch (e: Exception) {
                    null
                } ?: run {
                    // Fallback for GitHub Pages static hosting / CDN downloads
                    val serverBase = ASquareApplication.instance.serverUrl.trimEnd('/')
                    val apkUrl = when {
                        !appItem.apkFile.isNullOrBlank() && appItem.apkFile.startsWith("http") -> appItem.apkFile
                        !appItem.apkFile.isNullOrBlank() -> "$serverBase/apps/${appItem.apkFile}"
                        else -> "$serverBase/apps/${appItem.id}.apk"
                    }
                    service.downloadFileFromUrl(apkUrl)
                }

                if (!response.isSuccessful || response.body() == null) {
                    withContext(Dispatchers.Main) {
                        callback.onError("Server returned error: ${response.code()}")
                    }
                    return@withContext
                }

                val body = response.body()!!
                val contentLength = body.contentLength()
                val inputStream: InputStream = body.byteStream()

                val downloadsDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: activity.filesDir
                val destinationFile = File(downloadsDir, "${appItem.id}-v${appItem.version ?: "1.0"}.apk")

                val outputStream = FileOutputStream(destinationFile)
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalBytesRead = 0L

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalBytesRead += bytesRead

                    if (contentLength > 0) {
                        val progress = ((totalBytesRead * 100) / contentLength).toInt()
                        withContext(Dispatchers.Main) {
                            callback.onProgress(progress)
                        }
                    }
                }

                outputStream.flush()
                outputStream.close()
                inputStream.close()

                withContext(Dispatchers.Main) {
                    callback.onSuccess(destinationFile)
                    promptInstall(activity, destinationFile)
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    callback.onError(e.localizedMessage ?: "Download failed")
                }
            }
        }
    }

    fun promptInstall(activity: Activity, apkFile: File) {
        if (!apkFile.exists()) {
            Toast.makeText(activity, "APK file not found.", Toast.LENGTH_SHORT).show()
            return
        }

        // On Android 8.0 (API 26) and higher, check unknown sources install permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!activity.packageManager.canRequestPackageInstalls()) {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${activity.packageName}")
                }
                activity.startActivity(intent)
                Toast.makeText(
                    activity,
                    "Allow ASquare Store to install APKs, then tap install again.",
                    Toast.LENGTH_LONG
                ).show()
                return
            }
        }

        try {
            val authority = "${activity.packageName}.fileprovider"
            val apkUri: Uri = FileProvider.getUriForFile(activity, authority, apkFile)

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            activity.startActivity(installIntent)
        } catch (e: Exception) {
            Toast.makeText(
                activity,
                "Failed to trigger package installer: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
