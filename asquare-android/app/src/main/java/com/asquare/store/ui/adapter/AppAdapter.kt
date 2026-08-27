package com.asquare.store.ui.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.RoundedCornersTransformation
import com.asquare.store.ASquareApplication
import com.asquare.store.R
import com.asquare.store.data.model.AppItem
import com.asquare.store.databinding.ItemAppCardBinding

class AppAdapter(
    private var apps: List<AppItem>,
    private val onAppClick: (AppItem) -> Unit,
    private val onInstallClick: (AppItem, ItemAppCardBinding) -> Unit
) : RecyclerView.Adapter<AppAdapter.AppViewHolder>() {

    fun updateApps(newApps: List<AppItem>) {
        apps = newApps
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AppViewHolder {
        val binding = ItemAppCardBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AppViewHolder(binding)
    }

    override fun onBindViewHolder(holder: AppViewHolder, position: Int) {
        holder.bind(apps[position])
    }

    override fun getItemCount(): Int = apps.size

    inner class AppViewHolder(val binding: ItemAppCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(app: AppItem) {
            binding.tvAppName.text = app.name
            binding.tvDeveloperCategory.text = "${app.developerName ?: "Developer"} · ${app.category ?: "General"}"
            binding.tvSummary.text = app.summary ?: app.description ?: "Verified Android Application"

            binding.tvRating.text = "★ ${String.format("%.1f", app.rating ?: 5.0)}"
            binding.tvSize.text = app.size ?: "APK"
            binding.tvDownloads.text = "${app.downloads ?: 0} DL"

            // Load icon with resolved URL
            val iconUrl = app.getResolvedIconUrl()
            if (iconUrl != null) {
                binding.ivAppIcon.load(iconUrl) {
                    crossfade(true)
                    placeholder(android.R.drawable.sym_def_app_icon)
                    error(android.R.drawable.sym_def_app_icon)
                    transformations(RoundedCornersTransformation(16f))
                }
            } else {
                binding.ivAppIcon.setImageResource(android.R.drawable.sym_def_app_icon)
            }

            binding.root.setOnClickListener {
                onAppClick(app)
            }

            binding.btnAction.setOnClickListener {
                onInstallClick(app, binding)
            }
        }
    }
}
