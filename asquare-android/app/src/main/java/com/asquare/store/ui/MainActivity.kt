package com.asquare.store.ui

import android.app.AlertDialog
import android.content.res.ColorStateList
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import coil.transform.RoundedCornersTransformation
import com.asquare.store.ASquareApplication
import com.asquare.store.R
import com.asquare.store.data.api.ASquareApiClient
import com.asquare.store.data.model.AppItem
import com.asquare.store.databinding.ActivityMainBinding
import com.asquare.store.databinding.DialogAppDetailsBinding
import com.asquare.store.databinding.DialogHardwareSpecBinding
import com.asquare.store.databinding.ItemAppCardBinding
import com.asquare.store.installer.ApkDownloadInstaller
import com.asquare.store.ui.adapter.AppAdapter
import com.asquare.store.util.DeviceUtils
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.chip.Chip
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var appAdapter: AppAdapter

    private var allApps: List<AppItem> = emptyList()
    private var selectedCategory: String? = null
    private var searchQuery: String? = null
    private var searchDebounceJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupListeners()
        loadCategories()
        fetchApps()
    }

    private fun setupRecyclerView() {
        appAdapter = AppAdapter(
            apps = emptyList(),
            onAppClick = { app -> showAppDetailsDialog(app) },
            onInstallClick = { app, itemBinding -> startDownloadAndInstall(app, itemBinding) }
        )
        binding.rvApps.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = appAdapter
            itemAnimator = null
        }
        binding.swipeRefresh.setColorSchemeResources(R.color.neon_cyan, R.color.neon_purple)
    }

    private fun setupListeners() {
        binding.swipeRefresh.setOnRefreshListener {
            fetchApps()
        }

        binding.btnHardwareInfo.setOnClickListener {
            showHardwareSpecsDialog()
        }

        binding.btnSettings.setOnClickListener {
            showServerSettingsDialog()
        }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                binding.btnClearSearch.visibility = if (s.isNullOrEmpty()) View.GONE else View.VISIBLE
                searchDebounceJob?.cancel()
                searchDebounceJob = lifecycleScope.launch {
                    delay(300)
                    searchQuery = s?.toString()?.trim()
                    filterApps()
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.btnClearSearch.setOnClickListener {
            binding.etSearch.setText("")
            searchQuery = null
            filterApps()
        }

        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_discover -> {
                    selectedCategory = null
                    filterApps()
                    true
                }
                R.id.nav_browse -> {
                    binding.etSearch.requestFocus()
                    true
                }
                R.id.nav_hardware -> {
                    showHardwareSpecsDialog()
                    true
                }
                else -> false
            }
        }
    }

    private fun loadCategories() {
        lifecycleScope.launch {
            try {
                val categories = ASquareApiClient.getService().getCategories()
                setupCategoryChips(categories)
            } catch (e: Exception) {
                // Fallback default categories
                setupCategoryChips(listOf("Tools", "Games", "Productivity", "Social", "Development"))
            }
        }
    }

    private fun setupCategoryChips(categories: List<String>) {
        binding.chipGroupCategories.removeAllViews()

        // "All" chip
        val allChip = Chip(this).apply {
            text = getString(R.string.category_all)
            isCheckable = true
            isChecked = true
            chipBackgroundColor = ColorStateList.valueOf(getColor(R.color.bg_elevated))
            chipStrokeColor = ColorStateList.valueOf(getColor(R.color.border_glass))
            chipStrokeWidth = resources.displayMetrics.density
            chipCornerRadius = 18f * resources.displayMetrics.density
            setTextColor(getColor(R.color.neon_cyan))
            setEnsureMinTouchTargetSize(false)
            minHeight = (36f * resources.displayMetrics.density).toInt()
            setOnCheckedChangeListener { _, isChecked ->
                if (isChecked) {
                    selectedCategory = null
                    filterApps()
                }
            }
        }
        binding.chipGroupCategories.addView(allChip)

        categories.forEach { cat ->
            val chip = Chip(this).apply {
                text = cat
                isCheckable = true
                chipBackgroundColor = ColorStateList.valueOf(getColor(R.color.bg_elevated))
                chipStrokeColor = ColorStateList.valueOf(getColor(R.color.border_glass))
                chipStrokeWidth = resources.displayMetrics.density
                chipCornerRadius = 18f * resources.displayMetrics.density
                setTextColor(getColor(R.color.text_primary))
                setEnsureMinTouchTargetSize(false)
                minHeight = (36f * resources.displayMetrics.density).toInt()
                setOnCheckedChangeListener { _, isChecked ->
                    if (isChecked) {
                        selectedCategory = cat
                        filterApps()
                    }
                }
            }
            binding.chipGroupCategories.addView(chip)
        }
    }

    private fun fetchApps() {
        binding.swipeRefresh.isRefreshing = true
        lifecycleScope.launch {
            try {
                val service = ASquareApiClient.getService()
                allApps = try {
                    service.getApps()
                } catch (apiErr: Exception) {
                    service.getAppsJson()
                }
                filterApps()
            } catch (e: Exception) {
                Toast.makeText(
                    this@MainActivity,
                    "Failed to connect to ASquare server: ${e.localizedMessage}",
                    Toast.LENGTH_LONG
                ).show()
                binding.tvEmptyState.visibility = if (allApps.isEmpty()) View.VISIBLE else View.GONE
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun filterApps() {
        var filtered = allApps

        if (!selectedCategory.isNullOrBlank()) {
            filtered = filtered.filter { it.category.equals(selectedCategory, ignoreCase = true) }
        }

        if (!searchQuery.isNullOrBlank()) {
            val q = searchQuery!!.lowercase()
            filtered = filtered.filter {
                it.name.lowercase().contains(q) ||
                (it.summary?.lowercase()?.contains(q) == true) ||
                (it.description?.lowercase()?.contains(q) == true) ||
                (it.developerName?.lowercase()?.contains(q) == true)
            }
        }

        appAdapter.updateApps(filtered)
        binding.tvEmptyState.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showAppDetailsDialog(app: AppItem) {
        val dialog = BottomSheetDialog(this, R.style.Theme_ASquareStore)
        val dialogBinding = DialogAppDetailsBinding.inflate(LayoutInflater.from(this))
        dialog.setContentView(dialogBinding.root)

        dialogBinding.tvDetailTitle.text = app.name
        dialogBinding.tvDetailDev.text = "By ${app.developerName ?: "ASquare Developer"} · v${app.version ?: "1.0.0"}"
        dialogBinding.tvDetailCategoryRating.text = "${app.category ?: "General"} · ★ ${String.format("%.1f", app.rating ?: 5.0)} (${app.downloads ?: 0} downloads)"
        dialogBinding.tvDetailDescription.text = app.description ?: app.summary ?: "Verified application from ASquare Repository."

        val hardwareInfo = DeviceUtils.getDeviceHardwareInfo(this)
        dialogBinding.tvCompatibilityBadge.text = "✓ Compatible with your device (${hardwareInfo.primaryAbi} · ${hardwareInfo.androidVersion})"

        val iconUrl = app.getResolvedIconUrl()
        if (iconUrl != null) {
            dialogBinding.ivDetailIcon.load(iconUrl) {
                crossfade(true)
                placeholder(android.R.drawable.sym_def_app_icon)
                error(android.R.drawable.sym_def_app_icon)
                transformations(RoundedCornersTransformation(16f))
            }
        }

        dialogBinding.btnClose.setOnClickListener { dialog.dismiss() }

        dialogBinding.btnDetailInstall.setOnClickListener {
            dialogBinding.btnDetailInstall.isEnabled = false
            dialogBinding.btnDetailInstall.text = "Downloading..."

            lifecycleScope.launch {
                ApkDownloadInstaller.downloadAndInstall(
                    this@MainActivity,
                    app,
                    object : ApkDownloadInstaller.DownloadCallback {
                        override fun onProgress(percentage: Int) {
                            dialogBinding.btnDetailInstall.text = "Downloading ($percentage%)..."
                        }

                        override fun onSuccess(apkFile: File) {
                            dialogBinding.btnDetailInstall.isEnabled = true
                            dialogBinding.btnDetailInstall.text = getString(R.string.btn_install)
                            dialog.dismiss()
                        }

                        override fun onError(errorMsg: String) {
                            dialogBinding.btnDetailInstall.isEnabled = true
                            dialogBinding.btnDetailInstall.text = getString(R.string.btn_install)
                            Toast.makeText(this@MainActivity, errorMsg, Toast.LENGTH_LONG).show()
                        }
                    }
                )
            }
        }

        dialog.show()
    }

    private fun startDownloadAndInstall(app: AppItem, itemBinding: ItemAppCardBinding) {
        itemBinding.btnAction.visibility = View.INVISIBLE
        itemBinding.pbDownload.visibility = View.VISIBLE

        lifecycleScope.launch {
            ApkDownloadInstaller.downloadAndInstall(
                this@MainActivity,
                app,
                object : ApkDownloadInstaller.DownloadCallback {
                    override fun onProgress(percentage: Int) {}

                    override fun onSuccess(apkFile: File) {
                        itemBinding.pbDownload.visibility = View.GONE
                        itemBinding.btnAction.visibility = View.VISIBLE
                        itemBinding.btnAction.text = getString(R.string.btn_open)
                    }

                    override fun onError(errorMsg: String) {
                        itemBinding.pbDownload.visibility = View.GONE
                        itemBinding.btnAction.visibility = View.VISIBLE
                        Toast.makeText(this@MainActivity, errorMsg, Toast.LENGTH_LONG).show()
                    }
                }
            )
        }
    }

    private fun showHardwareSpecsDialog() {
        val dialog = AlertDialog.Builder(this)
            .create()

        val diagBinding = DialogHardwareSpecBinding.inflate(layoutInflater)
        dialog.setView(diagBinding.root)

        val info = DeviceUtils.getDeviceHardwareInfo(this)
        diagBinding.tvCpuAbi.text = "${info.primaryAbi} (Supported: ${info.supportedAbis.joinToString(", ")})"
        diagBinding.tvAndroidVersion.text = info.androidVersion
        diagBinding.tvDeviceModel.text = info.deviceModel
        diagBinding.tvScreenDensity.text = "${info.screenDensityBucket} (${info.screenDpi} dpi)"

        diagBinding.btnCloseDialog.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    private fun showServerSettingsDialog() {
        val currentUrl = ASquareApplication.instance.serverUrl
        val input = EditText(this).apply {
            setText(currentUrl)
            setSelection(currentUrl.length)
            hint = "http://10.0.2.2:3000"
            setTextColor(getColor(R.color.text_primary))
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.server_settings_title)
            .setMessage("Set ASquare backend API server URL (use 10.0.2.2:3000 for emulator or your LAN/domain IP):")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    ASquareApplication.instance.serverUrl = newUrl
                    Toast.makeText(this, "Updated server to: $newUrl", Toast.LENGTH_SHORT).show()
                    fetchApps()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
