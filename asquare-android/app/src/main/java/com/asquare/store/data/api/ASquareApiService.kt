package com.asquare.store.data.api

import com.asquare.store.ASquareApplication
import com.asquare.store.data.model.AppItem
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import java.util.concurrent.TimeUnit

interface ASquareApiService {

    @GET("api/apps")
    suspend fun getApps(
        @Query("category") category: String? = null,
        @Query("search") search: String? = null
    ): List<AppItem>

    @GET("apps.json")
    suspend fun getAppsJson(): List<AppItem>

    @GET("api/apps/{id}")
    suspend fun getAppById(@Path("id") id: String): AppItem

    @GET("api/categories")
    suspend fun getCategories(): List<String>

    @Streaming
    @GET("api/apps/{id}/download")
    suspend fun downloadApk(@Path("id") id: String): Response<ResponseBody>

    @Streaming
    @GET
    suspend fun downloadFileFromUrl(@retrofit2.http.Url fileUrl: String): Response<ResponseBody>
}

object ASquareApiClient {

    private var currentBaseUrl: String? = null
    private var serviceInstance: ASquareApiService? = null

    fun getService(): ASquareApiService {
        val baseUrl = ASquareApplication.instance.serverUrl.let {
            if (it.endsWith("/")) it else "$it/"
        }

        if (serviceInstance == null || currentBaseUrl != baseUrl) {
            currentBaseUrl = baseUrl

            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }

            val okHttpClient = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .addInterceptor(logging)
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            serviceInstance = retrofit.create(ASquareApiService::class.java)
        }

        return serviceInstance!!
    }
}
