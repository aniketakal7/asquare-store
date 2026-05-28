// ====================================
// ASquare Store - Admin Console Controller
// ====================================

document.addEventListener('DOMContentLoaded', () => {
    // ---- State ----
    let adminKey = sessionStorage.getItem('asquare_admin_key') || '';
    let allApps = [];

    // ---- DOM References ----
    const authOverlay = document.getElementById('auth-overlay');
    const authForm = document.getElementById('auth-form');
    const adminPasscode = document.getElementById('admin-passcode');
    const authError = document.getElementById('auth-error');

    const btnLogout = document.getElementById('btn-logout');

    const statPending = document.getElementById('stat-pending');
    const statPublished = document.getElementById('stat-published');
    const statDownloads = document.getElementById('stat-downloads');

    const pendingQueueList = document.getElementById('pending-queue-list');
    const queueEmpty = document.getElementById('queue-empty');
    const badgePendingCount = document.getElementById('badge-pending-count');

    const catalogList = document.getElementById('catalog-list');
    const badgeCatalogCount = document.getElementById('badge-catalog-count');

    // Toast References
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMessage = document.getElementById('toast-message');

    // ==================
    // AUTH CHECK SYSTEM
    // ==================
    if (adminKey) {
        // Attempt auto-unlock
        testAndUnlock(adminKey);
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredPasscode = adminPasscode.value.trim();
        if (!enteredPasscode) return;

        authError.style.display = 'none';
        const success = await testAndUnlock(enteredPasscode);

        if (!success) {
            authError.style.display = 'block';
            adminPasscode.value = '';
            adminPasscode.focus();
        }
    });

    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('asquare_admin_key');
        window.location.reload();
    });

    async function testAndUnlock(key) {
        try {
            // Attempt to fetch using key
            const res = await fetch('/api/admin/apps', {
                headers: { 'x-admin-key': key }
            });

            if (!res.ok) {
                throw new Error('Access denied');
            }

            // Key is valid! Save session and load console
            adminKey = key;
            sessionStorage.setItem('asquare_admin_key', key);
            authOverlay.style.display = 'none';
            showToast('🔓', 'Admin console unlocked.');

            allApps = await res.json();
            renderDashboard();
            return true;

        } catch (err) {
            console.error('[Console] Auth failed:', err);
            return false;
        }
    }

    // ==================
    // RENDER DASHBOARD
    // ==================
    function renderDashboard() {
        const pendingApps = allApps.filter(a => a.status === 'pending');
        const publishedApps = allApps.filter(a => a.status === 'published');

        // Render Stats
        statPending.textContent = pendingApps.length;
        statPublished.textContent = publishedApps.length;
        const totalDownloads = allApps.reduce((sum, app) => sum + (app.downloads || 0), 0);
        statDownloads.textContent = formatNumber(totalDownloads);

        // Render Queue
        badgePendingCount.textContent = `${pendingApps.length} Pending`;
        if (pendingApps.length === 0) {
            pendingQueueList.innerHTML = '';
            queueEmpty.style.display = 'block';
        } else {
            queueEmpty.style.display = 'none';
            pendingQueueList.innerHTML = pendingApps.map(a => modCardHTML(a, true)).join('');
            bindQueueActions();
        }

        // Render Catalog
        badgeCatalogCount.textContent = `${publishedApps.length} Published`;
        catalogList.innerHTML = publishedApps.map(a => modCardHTML(a, false)).join('');
        bindCatalogActions();
    }

    function modCardHTML(app, isPending) {
        const iconContent = app.iconFile
            ? `<img src="${app.iconFile}" alt="${app.name}">`
            : (app.icon || '📦');

        const apkActionHTML = app.apkFile
            ? `<a href="/download/${app.apkFile}" class="btn-mod btn-mod-download" title="Download APK file to audit safety">📥 Download APK</a>`
            : `<span style="font-size:0.8rem; color:var(--text-dim);">No APK Attached</span>`;

        const actionButtonsHTML = isPending
            ? `
                <button class="btn-mod btn-mod-approve" data-approve-id="${app.id}">✅ Approve & Publish</button>
                <button class="btn-mod btn-mod-reject" data-reject-id="${app.id}">❌ Reject Submission</button>
              `
            : app.protected
                ? `<span class="protected-badge" title="Protected System App" style="font-size: 0.8rem; font-weight:600; color: var(--text-dim); display:inline-flex; align-items:center; gap:4px;">🛡️ Protected System App</span>`
                : `<button class="btn-mod btn-mod-reject" data-takedown-id="${app.id}">🚫 Take Down App</button>`;

        const descriptionHTML = app.description
            ? `<div class="mod-description"><strong>Description:</strong> ${escapeHTML(app.description)}</div>`
            : '';

        return `
            <div class="mod-card glass">
                <div class="mod-header">
                    <div class="mod-icon">${iconContent}</div>
                    <div class="mod-info">
                        <div class="mod-name-row">
                            <span class="mod-name">${escapeHTML(app.name)}</span>
                            <span class="mod-version">v${app.version}</span>
                        </div>
                        <div class="mod-meta">
                            <span>Developer: <strong>${escapeHTML(app.developerName)}</strong></span>
                            <span>Category: <strong>${escapeHTML(app.category)}</strong></span>
                            <span>Downloads: <strong>${formatNumber(app.downloads)}</strong></span>
                            <span>Size: <strong>${app.size || 'N/A'}</strong></span>
                        </div>
                        <div class="mod-summary">${escapeHTML(app.summary)}</div>
                        ${descriptionHTML}
                    </div>
                </div>
                <div class="mod-actions">
                    ${apkActionHTML}
                    <div style="flex-grow: 1;"></div>
                    ${actionButtonsHTML}
                </div>
            </div>
        `;
    }

    // ==================
    // ACTION BINDINGS
    // ==================
    function bindQueueActions() {
        // Approve Button
        pendingQueueList.querySelectorAll('[data-approve-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.approveId;
                const app = allApps.find(a => a.id === id);
                if (!app) return;

                btn.disabled = true;
                btn.textContent = 'Publishing...';

                try {
                    const res = await fetch(`/api/admin/apps/${id}/approve`, {
                        method: 'POST',
                        headers: { 'x-admin-key': adminKey }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        showToast('✅', `"${app.name}" published successfully!`);
                        // Refresh data
                        allApps = allApps.map(a => a.id === id ? { ...a, status: 'published' } : a);
                        renderDashboard();
                    } else {
                        throw new Error('Approval request failed');
                    }
                } catch (err) {
                    showToast('❌', 'Approval failed. Try again.');
                    btn.disabled = false;
                    btn.innerHTML = '✅ Approve & Publish';
                }
            });
        });

        // Reject Button
        pendingQueueList.querySelectorAll('[data-reject-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.rejectId;
                const app = allApps.find(a => a.id === id);
                if (!app) return;

                if (!confirm(`Reject submission "${app.name}"? This deletes the app metadata and uploaded files.`)) return;

                try {
                    const res = await fetch(`/api/apps/${id}`, {
                        method: 'DELETE',
                        headers: { 'x-admin-key': adminKey }
                    });

                    if (res.ok) {
                        showToast('🗑️', `"${app.name}" submission rejected and deleted.`);
                        allApps = allApps.filter(a => a.id !== id);
                        renderDashboard();
                    } else {
                        throw new Error('Rejection request failed');
                    }
                } catch (err) {
                    showToast('❌', 'Failed to reject submission.');
                }
            });
        });
    }

    function bindCatalogActions() {
        // Take Down Button
        catalogList.querySelectorAll('[data-takedown-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.takedownId;
                const app = allApps.find(a => a.id === id);
                if (!app) return;

                if (!confirm(`Take down "${app.name}" from public listing? This removes it from the store catalog.`)) return;

                try {
                    const res = await fetch(`/api/apps/${id}`, {
                        method: 'DELETE',
                        headers: { 'x-admin-key': adminKey }
                    });

                    if (res.ok) {
                        showToast('🚫', `"${app.name}" taken down from ASquare Store.`);
                        allApps = allApps.filter(a => a.id !== id);
                        renderDashboard();
                    } else {
                        throw new Error('Takedown request failed');
                    }
                } catch (err) {
                    showToast('❌', 'Failed to take down app.');
                }
            });
        });
    }

    // ==================
    // UTILITIES & TOAST
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
