package com.asquare.store.data.model

import com.google.gson.annotations.SerializedName

data class AppItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("category") val category: String? = null,
    @SerializedName("version") val version: String? = "1.0.0",
    @SerializedName("summary") val summary: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("developerName") val developerName: String? = null,
    @SerializedName("developerId") val developerId: String? = null,
    @SerializedName("icon") val icon: String? = null,
    @SerializedName("iconFile") val iconFile: String? = null,
    @SerializedName("apkFile") val apkFile: String? = null,
    @SerializedName("size") val size: String? = null,
    @SerializedName("downloads") val downloads: Int? = 0,
    @SerializedName("rating") val rating: Double? = 5.0,
    @SerializedName("publishedAt") val publishedAt: String? = null,
    @SerializedName("featured") val featured: Boolean? = false,
    @SerializedName("status") val status: String? = "approved"
)

data class CategoryItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("count") val count: Int? = 0
)

data class DeviceHardwareInfo(
    val primaryAbi: String,
    val supportedAbis: List<String>,
    val androidVersion: String,
    val sdkInt: Int,
    val deviceModel: String,
    val manufacturer: String,
    val screenDpi: Int,
    val screenDensityBucket: String,
    val totalRamGb: String
)
