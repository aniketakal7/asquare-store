// ====================================
// ASquare Play Console - Controller Script
// ====================================

document.addEventListener('DOMContentLoaded', () => {
    // ---- Onboarding / Session State ----
    let devName = localStorage.getItem('asquare_dev_name') || '';
    let devId = localStorage.getItem('asquare_dev_id') || '';
    let allApps = [];

    // ---- DOM References ----
    const onboardOverlay = document.getElementById('onboard-overlay');
    const onboardForm = document.getElementById('onboard-form');
    const devProfileNameInput = document.getElementById('dev-profile-name');

    const displayDevName = document.getElementById('display-dev-name');
    const displayDevId = document.getElementById('display-dev-id');
    const btnSwitchProfile = document.getElementById('btn-switch-profile');

    const statPending = document.getElementById('stat-pending');
    const statPublished = document.getElementById('stat-published');
    const statInstalls = document.getElementById('stat-installs');

    // Form
    const uploadForm = document.getElementById('upload-form');
    const dropzone = document.getElementById('dropzone');
    const apkInput = document.getElementById('app-apk-file');
    const apkFilename = document.getElementById('apk-filename');
    const iconFileInput = document.getElementById('app-icon-file');
    const iconFilename = document.getElementById('icon-filename');
    const emojiPicker = document.getElementById('emoji-picker');
    const btnPublish = document.getElementById('btn-publish');
    const uploadSuccess = document.getElementById('upload-success');
    const btnAnother = document.getElementById('btn-another');
    const appDeveloperHidden = document.getElementById('app-developer');

    // List references
    const myUploadsList = document.getElementById('my-uploads-list');
    const myUploadsEmpty = document.getElementById('my-uploads-empty');

    // Toast
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMessage = document.getElementById('toast-message');

    // ==================
    // SESSION MANAGER
    // ==================
    if (!devId || !devName) {
        // First visit - display onboarding screen
        onboardOverlay.style.display = 'flex';
    } else {
        initializeConsole();
    }

    onboardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputName = devProfileNameInput.value.trim();
        if (!inputName) return;

        // Generate custom Dev ID
        const randomId = 'dev-' + Math.random().toString(36).substring(2, 8) + Math.floor(Math.random() * 1000).toString();
        
        localStorage.setItem('asquare_dev_name', inputName);
        localStorage.setItem('asquare_dev_id', randomId);

        devName = inputName;
        devId = randomId;

        onboardOverlay.style.display = 'none';
        showToast('🎉', 'Developer Workspace created successfully!');
        initializeConsole();
    });

    btnSwitchProfile.addEventListener('click', () => {
        const newName = prompt('Enter your new Developer / Studio Name:', devName);
        if (newName === null) return;
        if (!newName.trim()) {
            showToast('❌', 'Developer Name cannot be empty.');
            return;
        }

        localStorage.setItem('asquare_dev_name', newName.trim());
        devName = newName.trim();
        displayDevName.textContent = devName;
        showToast('✏️', 'Developer Profile updated.');
        
        // Update all existing items in state
        allApps.forEach(a => a.developerName = devName);
        renderMySubmissions();
    });

    function initializeConsole() {
        displayDevName.textContent = devName;
        displayDevId.textContent = `Developer ID: ${devId}`;
        appDeveloperHidden.value = devName; // Set hidden developerName field
        fetchMyApps();
    }

    // ==================
    // FETCH APPS API
    // ==================
    async function fetchMyApps() {
        try {
            const res = await fetch(`/api/developer/apps?developerId=${devId}`);
            if (res.ok) {
                allApps = await res.json();
                renderMySubmissions();
            }
        } catch (err) {
            console.error('[Console] Failed to fetch submissions:', err);
            showToast('❌', 'Failed to retrieve uploads list.');
        }
    }

    function renderMySubmissions() {
        if (!myUploadsList) return;

        const pendingList = allApps.filter(a => a.status === 'pending');
        const publishedList = allApps.filter(a => a.status === 'published');
        const totalInstalls = allApps.reduce((sum, a) => sum + (a.downloads || 0), 0);

        // Update Stats widget
        statPending.textContent = pendingList.length;
        statPublished.textContent = publishedList.length;
        statInstalls.textContent = formatNumber(totalInstalls);

        if (allApps.length === 0) {
            myUploadsList.innerHTML = '';
            myUploadsEmpty.style.display = 'block';
            return;
        }

        myUploadsEmpty.style.display = 'none';

        // Sort by upload date
        const sorted = [...allApps].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        myUploadsList.innerHTML = sorted.map(app => {
            const iconContent = app.iconFile
                ? `<img src="${app.iconFile}" alt="${app.name}">`
                : (app.icon || '📦');

            const statusClass = app.status === 'published' ? 'status-published' : 'status-pending';
            const statusLabel = app.status === 'published' ? '🟢 Published' : '⏳ In Review';

            return `
                <div class="my-upload-item" data-app-id="${app.id}">
                     <div class="my-upload-icon">${iconContent}</div>
                     <div class="my-upload-info">
                         <div class="my-upload-name" style="display:flex; align-items:center; gap:8px;">
                             <span>${escapeHTML(app.name)}</span>
                             <span class="status-badge ${statusClass}">${statusLabel}</span>
                         </div>
                         <div class="my-upload-meta">v${app.version} • ${formatNumber(app.downloads)} installs</div>
                     </div>
                </div>
            `;
        }).join('');
    }

    // ==================
    // FORM FILE SELECTION
    // ==================

    // Emoji picker
    let selectedEmoji = '📦';
    if (emojiPicker) {
        emojiPicker.addEventListener('click', (e) => {
            const option = e.target.closest('.emoji-option');
            if (!option) return;
            emojiPicker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedEmoji = option.dataset.emoji;

            // Deselect icon file if emoji is picked
            if (iconFileInput) iconFileInput.value = '';
            if (iconFilename) iconFilename.textContent = '';
        });
    }

    // Icon file uploader mini
    if (iconFileInput) {
        iconFileInput.addEventListener('change', () => {
            if (iconFileInput.files[0]) {
                iconFilename.textContent = iconFileInput.files[0].name;
                // Deselect emoji picker
                emojiPicker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
                selectedEmoji = null;
            }
        });
    }

    // Drag-and-drop Dropzone
    if (dropzone) {
        dropzone.addEventListener('click', () => apkInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) {
                apkInput.files = e.dataTransfer.files;
                updateApkFilename();
            }
        });
    }

    if (apkInput) {
        apkInput.addEventListener('change', updateApkFilename);
    }

    function updateApkFilename() {
        if (apkInput.files[0]) {
            const file = apkInput.files[0];
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            apkFilename.textContent = `📎 ${file.name} (${sizeMB}MB)`;
            document.getElementById('dropzone-content').innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p style="color: var(--accent);">File selected!</p>
                <span>${file.name}</span>
            `;
        }
    }

    // ==================
    // UPLOAD APP API
    // ==================
    
    // Global error handler for console debugging
    window.addEventListener('error', (event) => {
        console.error('[Console Critical Error]', event.error);
        showToast('❌', `System Error: ${event.message}`);
    });

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('[Console Uploader] Submit event triggered');

            try {
                // Guard check for APK
                if (!apkInput.files || !apkInput.files[0]) {
                    console.log('[Console Uploader] Guard check failed: No APK file');
                    showToast('❌', 'Please attach an APK or project file.');
                    return;
                }

                console.log('[Console Uploader] Preparing FormData...');
                const formData = new FormData();
                formData.append('name', document.getElementById('app-name').value.trim());
                formData.append('category', document.getElementById('app-category').value);
                formData.append('version', document.getElementById('app-version').value.trim());
                formData.append('summary', document.getElementById('app-summary').value.trim());
                formData.append('description', (document.getElementById('app-description').value || '').trim());
                
                // Set dynamic developer identifiers
                formData.append('developerName', devName);
                formData.append('developerId', devId);

                // Icon: file or emoji
                if (iconFileInput && iconFileInput.files && iconFileInput.files[0]) {
                    console.log('[Console Uploader] Attaching icon file');
                    formData.append('icon', iconFileInput.files[0]);
                }
                formData.append('emojiIcon', selectedEmoji || '📦');

                // APK
                console.log('[Console Uploader] Attaching APK file:', apkInput.files[0].name);
                formData.append('apk', apkInput.files[0]);

                // Disable buttons and show loading spinner
                console.log('[Console Uploader] Setting button to loading state');
                btnPublish.disabled = true;
                const btnText = btnPublish.querySelector('.btn-publish-text');
                const btnLoading = btnPublish.querySelector('.btn-publish-loading');
                if (btnText) btnText.style.display = 'none';
                if (btnLoading) btnLoading.style.display = 'inline-flex';

                console.log('[Console Uploader] Sending POST request to /api/apps...');
                const res = await fetch('/api/apps', {
                    method: 'POST',
                    body: formData
                });

                console.log('[Console Uploader] Fetch resolved. Status code:', res.status);

                if (!res.ok) {
                    let errorMessage = 'Submission failed';
                    try {
                        const err = await res.json();
                        errorMessage = err.error || errorMessage;
                    } catch (parseErr) {
                        console.warn('[Console Uploader] Could not parse error response as JSON');
                        const textErr = await res.text();
                        errorMessage = textErr || errorMessage;
                    }
                    throw new Error(errorMessage);
                }

                const newApp = await res.json();
                console.log('[Console Uploader] Success! Submitted app:', newApp.name);
                allApps.push(newApp);

                // Show success container
                uploadForm.style.display = 'none';
                uploadSuccess.style.display = 'block';

                showToast('🎉', `${newApp.name} submitted for review!`);
                renderMySubmissions();

            } catch (err) {
                console.error('[Console Uploader] Submission process failed:', err);
                showToast('❌', err.message || 'Failed to submit application.');
            } finally {
                console.log('[Console Uploader] Resetting button state');
                btnPublish.disabled = false;
                const btnText = btnPublish.querySelector('.btn-publish-text');
                const btnLoading = btnPublish.querySelector('.btn-publish-loading');
                if (btnText) btnText.style.display = '';
                if (btnLoading) btnLoading.style.display = 'none';
            }
        });
    }

    // Submit Another App
    if (btnAnother) {
        btnAnother.addEventListener('click', () => {
            uploadForm.reset();
            uploadForm.style.display = 'block';
            uploadSuccess.style.display = 'none';
            apkFilename.textContent = '';
            iconFilename.textContent = '';
            selectedEmoji = '📦';

            // Reset emoji selections
            emojiPicker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
            emojiPicker.querySelector('[data-emoji="📦"]')?.classList.add('selected');

            // Reset dropzone markup
            document.getElementById('dropzone-content').innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>Drag & drop your APK here</p>
                <span>or <strong>click to browse</strong></span>
            `;
        });
    }

    // ==================
    // TOASTS & UTILS
    // ==================
    let toastTimeout;
    function showToast(icon, message) {
        toastIcon.textContent = icon;
        toastMessage.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    function formatNumber(n) {
        if (!n && n !== 0) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
