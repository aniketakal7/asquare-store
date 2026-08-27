// ====================================
// ASquare Play Console - Controller Script
// ====================================

document.addEventListener('DOMContentLoaded', () => {
    // ---- Onboarding / Session State ----
    let devName = localStorage.getItem('asquare_dev_name') || '';
    let devId = localStorage.getItem('asquare_dev_id') || '';
    let devToken = localStorage.getItem('asquare_dev_token') || '';
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
    if (!devId || !devName || !devToken) {
        // First visit or unauthenticated - display onboarding screen
        onboardOverlay.style.display = 'flex';
    } else {
        initializeConsole();
    }

    async function registerAccount(name) {
        try {
            const res = await fetch('/api/developer/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Registration failed');
            }

            const data = await res.json();
            localStorage.setItem('asquare_dev_name', data.name);
            localStorage.setItem('asquare_dev_id', data.developerId);
            localStorage.setItem('asquare_dev_token', data.token);

            devName = data.name;
            devId = data.developerId;
            devToken = data.token;

            return true;
        } catch (err) {
            showToast('❌', err.message);
            return false;
        }
    }

    onboardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputName = devProfileNameInput.value.trim();
        if (!inputName) return;

        const success = await registerAccount(inputName);
        if (success) {
            onboardOverlay.style.display = 'none';
            showToast('🎉', 'Developer Workspace created successfully!');
            initializeConsole();
        }
    });

    btnSwitchProfile.addEventListener('click', async () => {
        const newName = prompt('Enter your new Developer / Studio Name to create a new profile:', devName);
        if (newName === null) return;
        if (!newName.trim()) {
            showToast('❌', 'Developer Name cannot be empty.');
            return;
        }

        const success = await registerAccount(newName.trim());
        if (success) {
            displayDevName.textContent = devName;
            displayDevId.textContent = `Developer ID: ${devId}`;
            showToast('✨', 'Switched to new Developer Profile.');
            fetchMyApps();
        }
    });

    function initializeConsole() {
        displayDevName.textContent = devName;
        displayDevId.textContent = `Developer ID: ${devId}`;
        if (appDeveloperHidden) appDeveloperHidden.value = devName;
        fetchMyApps();
    }

    // ==================
    // FETCH APPS API
    // ==================
    async function fetchMyApps() {
        try {
            const headers = {};
            if (devToken) headers['x-dev-token'] = devToken;

            const res = await fetch(`/api/developer/apps?developerId=${devId}`, { headers });
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

            let statusClass = 'status-pending';
            let statusLabel = '⏳ In Review';

            if (app.status === 'published') {
                statusClass = 'status-published';
                statusLabel = '🟢 Published';
            } else if (app.status === 'rejected') {
                statusClass = 'status-rejected';
                statusLabel = '❌ Rejected';
            }

            const rejectionMsg = app.status === 'rejected' && app.rejectionReason
                ? `<div style="font-size:0.8rem; color:#ef4444; margin-top:4px;">Reason: ${escapeHTML(app.rejectionReason)}</div>`
                : '';

            return `
                <div class="my-upload-item" data-app-id="${app.id}">
                     <div class="my-upload-icon">${iconContent}</div>
                     <div class="my-upload-info" style="flex:1;">
                         <div class="my-upload-name" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                             <span style="font-weight:700;">${escapeHTML(app.name)}</span>
                             <span class="status-badge ${statusClass}">${statusLabel}</span>
                         </div>
                         <div class="my-upload-meta">v${app.version} • ${formatNumber(app.downloads)} installs</div>
                         ${rejectionMsg}
                     </div>
                     <button type="button" class="btn-edit-app" data-edit-id="${app.id}" style="background:rgba(255,255,255,0.08); border:1px solid var(--glass-border); color:#fff; padding:6px 12px; border-radius:6px; font-size:0.8rem; cursor:pointer; font-weight:600;">✏️ Edit Icon</button>
                </div>
            `;
        }).join('');

        // Bind Edit buttons
        myUploadsList.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const appId = btn.dataset.editId;
                const app = allApps.find(a => a.id === appId);
                if (app) openEditModal(app);
            });
        });
    }

    // ==================
    // FORM FILE SELECTION
    // ==================

    let selectedEmoji = '📦';
    if (emojiPicker) {
        emojiPicker.addEventListener('click', (e) => {
            const option = e.target.closest('.emoji-option');
            if (!option) return;
            emojiPicker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedEmoji = option.dataset.emoji;

            if (iconFileInput) iconFileInput.value = '';
            if (iconFilename) iconFilename.textContent = '';
        });
    }

    if (iconFileInput) {
        iconFileInput.addEventListener('change', () => {
            if (iconFileInput.files[0]) {
                iconFilename.textContent = iconFileInput.files[0].name;
                if (emojiPicker) emojiPicker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
                selectedEmoji = null;
            }
        });
    }

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
    
    window.addEventListener('error', (event) => {
        console.error('[Console Critical Error]', event.error);
        showToast('❌', `System Error: ${event.message}`);
    });

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnText = btnPublish.querySelector('.btn-publish-text');
            const btnLoading = btnPublish.querySelector('.btn-publish-loading');

            function handleFailure(err) {
                console.error('[Console Uploader] Submission process failed:', err);
                showToast('❌', err.message || 'Failed to submit application.');
                resetButtonState();
            }

            function resetButtonState() {
                btnPublish.disabled = false;
                if (btnText) btnText.style.display = '';
                if (btnLoading) {
                    btnLoading.style.display = 'none';
                    btnLoading.innerHTML = `<span class="spinner"></span> Submitting...`;
                }
            }

            try {
                if (!apkInput.files || !apkInput.files[0]) {
                    showToast('❌', 'Please attach an APK file.');
                    return;
                }

                const formData = new FormData();
                formData.append('name', document.getElementById('app-name').value.trim());
                formData.append('category', document.getElementById('app-category').value);
                formData.append('version', document.getElementById('app-version').value.trim());
                formData.append('summary', document.getElementById('app-summary').value.trim());
                formData.append('description', (document.getElementById('app-description').value || '').trim());
                formData.append('developerName', devName);
                formData.append('developerId', devId);

                if (iconFileInput && iconFileInput.files && iconFileInput.files[0]) {
                    formData.append('icon', iconFileInput.files[0]);
                }
                formData.append('emojiIcon', selectedEmoji || '📦');
                formData.append('apk', apkInput.files[0]);

                btnPublish.disabled = true;
                if (btnText) btnText.style.display = 'none';
                if (btnLoading) btnLoading.style.display = 'inline-flex';

                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        if (btnLoading) {
                            btnLoading.innerHTML = `<span class="spinner"></span> Uploading... ${percent}%`;
                        }
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const newApp = JSON.parse(xhr.responseText);
                            allApps.push(newApp);

                            uploadForm.style.display = 'none';
                            uploadSuccess.style.display = 'block';

                            showToast('🎉', `${newApp.name} submitted for review!`);
                            renderMySubmissions();
                        } catch (parseErr) {
                            handleFailure(new Error('Failed to parse upload response from server.'));
                        }
                    } else {
                        let errorMessage = 'Submission failed';
                        try {
                            const errJson = JSON.parse(xhr.responseText);
                            errorMessage = errJson.error || errorMessage;
                        } catch (e) {
                            errorMessage = xhr.responseText || errorMessage;
                        }
                        handleFailure(new Error(errorMessage));
                    }
                });

                xhr.addEventListener('error', () => {
                    handleFailure(new Error('Network error. Check connection.'));
                });

                xhr.open('POST', '/api/apps');
                if (devToken) xhr.setRequestHeader('x-dev-token', devToken);
                xhr.send(formData);

            } catch (err) {
                handleFailure(err);
            }
        });
    }

    if (btnAnother) {
        btnAnother.addEventListener('click', () => {
            uploadForm.reset();
            uploadForm.style.display = 'block';
            uploadSuccess.style.display = 'none';
            apkFilename.textContent = '';
            iconFilename.textContent = '';
            selectedEmoji = '📦';

            if (emojiPicker) {
                emojiPicker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
                emojiPicker.querySelector('[data-emoji="📦"]')?.classList.add('selected');
            }

            document.getElementById('dropzone-content').innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p>Drag & drop your APK here</p>
                <span>or <strong>click to browse</strong></span>
            `;
        });
    }

    // ==================
    // EDIT APP MODAL LOGIC
    // ==================
    const editOverlay = document.getElementById('edit-app-overlay');
    const editForm = document.getElementById('edit-app-form');
    const btnCloseEdit = document.getElementById('btn-close-edit');

    function openEditModal(app) {
        document.getElementById('edit-app-id').value = app.id;
        document.getElementById('edit-app-version').value = app.version || '1.0.0';
        document.getElementById('edit-app-summary').value = app.summary || '';
        document.getElementById('edit-app-emoji').value = app.icon || '📦';
        document.getElementById('edit-app-icon-file').value = '';
        document.getElementById('edit-app-apk-file').value = '';
        editOverlay.style.display = 'flex';
    }

    if (btnCloseEdit) {
        btnCloseEdit.addEventListener('click', () => editOverlay.style.display = 'none');
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const appId = document.getElementById('edit-app-id').value;
            const version = document.getElementById('edit-app-version').value.trim();
            const summary = document.getElementById('edit-app-summary').value.trim();
            const emojiIcon = document.getElementById('edit-app-emoji').value.trim();

            const iconFileInput = document.getElementById('edit-app-icon-file');
            const apkFileInput = document.getElementById('edit-app-apk-file');

            const formData = new FormData();
            formData.append('version', version);
            formData.append('summary', summary);
            if (emojiIcon) formData.append('emojiIcon', emojiIcon);

            if (iconFileInput && iconFileInput.files[0]) {
                formData.append('icon', iconFileInput.files[0]);
            }
            if (apkFileInput && apkFileInput.files[0]) {
                formData.append('apk', apkFileInput.files[0]);
            }

            try {
                const headers = {};
                if (devToken) headers['x-dev-token'] = devToken;

                const res = await fetch(`/api/apps/${appId}`, {
                    method: 'PUT',
                    headers,
                    body: formData
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to update app');
                }

                showToast('✨', 'App icon & details updated successfully!');
                editOverlay.style.display = 'none';
                fetchMyApps();
            } catch (err) {
                showToast('❌', err.message);
            }
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
