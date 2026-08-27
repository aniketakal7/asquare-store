package com.asquare.store

import android.app.Application
import android.content.Context
import android.content.SharedPreferences

class ASquareApplication : Application() {

    companion object {
        lateinit var instance: ASquareApplication
            private set
        
        private const val PREFS_NAME = "asquare_store_prefs"
        private const val KEY_SERVER_URL = "server_url"
        
        // Default backend URL:
        // Set to your GitHub Pages repository so any user in the world can connect 24/7.
        // Can be changed in app settings for local testing (e.g. http://192.168.1.2:3000).
        const val DEFAULT_SERVER_URL = "https://aniketakal7.github.io/asquare-store"
    }

    private val prefs: SharedPreferences by lazy {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) {
            prefs.edit().putString(KEY_SERVER_URL, value.trimEnd('/')).apply()
        }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
