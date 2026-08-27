// ====================================
// ASquare Store - Interactive Controller
// ====================================

document.addEventListener('DOMContentLoaded', () => {
    // ---- State ----
    let allApps = [];
    let currentCategory = 'all';
    let currentSort = 'downloads';
    let currentSearch = '';
    let currentModalApp = null;

    // ---- DOM References ----
    const pages = document.querySelectorAll('.page');
    const tabs = document.querySelectorAll('.nav-tab');
    const navbar = document.getElementById('navbar');

    // Discover
    const discoverGrid = document.getElementById('discover-apps-grid');
    const recentRow = document.getElementById('recent-apps-row');
    const categoryPills = document.getElementById('category-pills');
    const seeAllBtn = document.getElementById('see-all-btn');

    // Featured Banner
    const featuredBanner = document.getElementById('featured-banner');
    const featuredIcon = document.getElementById('featured-icon');
    const featuredName = document.getElementById('featured-name');
    const featuredDeveloper = document.getElementById('featured-developer');
    const featuredSummary = document.getElementById('featured-summary');
    const featuredRating = document.getElementById('featured-rating');
    const featuredDownloads = document.getElementById('featured-downloads');
    const featuredSize = document.getElementById('featured-size');
    const featuredInstallBtn = document.getElementById('featured-install-btn');

    // Browse
    const browseGrid = document.getElementById('browse-apps-grid');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const sortSelect = document.getElementById('sort-select');
    const browsePills = document.getElementById('browse-category-pills');
    const resultsCount = document.getElementById('results-count');
    const browseEmpty = document.getElementById('browse-empty');


    // Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');

    // Toast
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMessage = document.getElementById('toast-message');

    // Nav search mini
    const navSearchMini = document.querySelector('.nav-search-mini');

    // ==================
    // TAB ROUTING
    // ==================
    function switchTab(tabName) {
        tabs.forEach(t => t.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));

        document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(t => t.classList.add('active'));
        const targetPage = document.getElementById(`page-${tabName}`);

        if (targetPage) {
            targetPage.classList.add('active');
            // Re-trigger animation
            targetPage.style.animation = 'none';
            targetPage.offsetHeight; // force reflow
            targetPage.style.animation = '';
        }

        // If switching to browse, focus search
        if (tabName === 'browse') {
            setTimeout(() => searchInput && searchInput.focus(), 300);
        }



        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Logo click -> discover
    document.getElementById('logo-home').addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('discover');
    });

    // See All -> browse
    if (seeAllBtn) {
        seeAllBtn.addEventListener('click', () => switchTab('browse'));
    }

    // Nav search mini -> browse
    if (navSearchMini) {
        navSearchMini.addEventListener('click', () => {
            switchTab('browse');
        });
    }

    // ==================
    // FETCH APPS
    // ==================
    const storeStatus = document.getElementById('store-status');
    const storeLoading = document.getElementById('store-loading');
    const storeError = document.getElementById('store-error');
    const storeRetryBtn = document.getElementById('store-retry-btn');

    async function fetchApps() {
        if (storeStatus) {
            storeStatus.style.display = 'block';
            storeLoading.style.display = 'block';
            storeError.style.display = 'none';
        }
        try {
            let res = await fetch('/api/apps').catch(() => null);
            if (!res || !res.ok) {
                res = await fetch('apps.json');
            }
            if (!res.ok) throw new Error('Could not fetch app catalog');
            allApps = await res.json();
            if (storeStatus) storeStatus.style.display = 'none';
            renderAll();
            openAppFromQuery();
        } catch (err) {
            console.warn('Could not fetch from API or apps.json:', err);
            allApps = [];
            if (storeStatus) {
                storeLoading.style.display = 'none';
                storeError.style.display = 'block';
            }
            renderAll();
        }
    }

    function openAppFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const appId = params.get('app');
        if (!appId) return;
        const app = allApps.find(a => a.id === appId);
        if (app) openModal(app);
    }

    if (storeRetryBtn) {
        storeRetryBtn.addEventListener('click', fetchApps);
    }

    function renderAll() {
        renderFeatured();
        renderDiscoverGrid();
        renderRecentRow();
        renderBrowseGrid();
    }

    // ==================
    // DISCOVER PAGE
    // ==================
    function renderFeatured() {
        const featured = allApps.find(a => a.featured) || allApps[0];
        if (!featured) return;

        if (featured.iconFile) {
            featuredIcon.innerHTML = `<img src="${featured.iconFile}" alt="${featured.name}">`;
        } else {
            featuredIcon.textContent = featured.icon || '📦';
        }
        featuredName.textContent = featured.name;
        featuredDeveloper.textContent = featured.developerName;
        featuredSummary.textContent = featured.summary;
        featuredRating.textContent = featured.rating || '—';
        featuredDownloads.textContent = formatNumber(featured.downloads);
        featuredSize.textContent = featured.size || 'N/A';

        featuredInstallBtn.onclick = (e) => {
            e.stopPropagation();
            if (featured.apkFile) {
                downloadApp(featured);
            } else {
                openModal(featured);
            }
        };
        featuredBanner.onclick = (e) => {
            if (e.target !== featuredInstallBtn) openModal(featured);
        };
    }

    function renderDiscoverGrid() {
        let filtered = [...allApps];
        if (currentCategory !== 'all') {
            filtered = filtered.filter(a => a.category === currentCategory);
        }
        // Sort by downloads (trending)
        filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        const top = filtered.slice(0, 6);
        discoverGrid.innerHTML = top.map(a => appCardHTML(a)).join('');
        bindCardClicks(discoverGrid);
    }

    function renderRecentRow() {
        const sorted = [...allApps].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        const recent = sorted.slice(0, 8);
        recentRow.innerHTML = recent.map(a => appCardHTML(a)).join('');
        bindCardClicks(recentRow);
    }

    // Category pills on discover
    if (categoryPills) {
        categoryPills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            categoryPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.dataset.category;
            renderDiscoverGrid();
        });
    }

    // ==================
    // BROWSE PAGE
    // ==================
    function renderBrowseGrid() {
        let filtered = [...allApps];

        // Category filter
        const activeCategory = browsePills?.querySelector('.pill.active')?.dataset.category || 'all';
        if (activeCategory !== 'all') {
            filtered = filtered.filter(a => a.category === activeCategory);
        }

        // Search filter
        if (currentSearch) {
            const q = currentSearch.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(q) ||
                a.summary.toLowerCase().includes(q) ||
                a.developerName.toLowerCase().includes(q) ||
                (a.category && a.category.toLowerCase().includes(q))
            );
        }

        // Sort
        switch (currentSort) {
            case 'downloads':
                filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
                break;
            case 'newest':
                filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
                break;
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'rating':
                filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
        }

        browseGrid.innerHTML = filtered.map(a => appCardHTML(a)).join('');
        bindCardClicks(browseGrid);

        // Results count
        resultsCount.textContent = `${filtered.length} app${filtered.length !== 1 ? 's' : ''} found`;

        // Empty state
        if (filtered.length === 0) {
            browseEmpty.style.display = 'block';
            browseGrid.style.display = 'none';
        } else {
            browseEmpty.style.display = 'none';
            browseGrid.style.display = '';
        }
    }

    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            searchClear.classList.toggle('visible', currentSearch.length > 0);
            renderBrowseGrid();
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            currentSearch = '';
            searchClear.classList.remove('visible');
            renderBrowseGrid();
            searchInput.focus();
        });
    }

    // Sort select
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderBrowseGrid();
        });
    }

    // Browse category pills
    if (browsePills) {
        browsePills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            browsePills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderBrowseGrid();
        });
    }

    // ==================
    // APP CARD HTML
    // ==================
    function appCardHTML(app) {
        const iconContent = app.iconFile
            ? `<img src="${app.iconFile}" alt="${app.name}">`
            : (app.icon || '📦');

        const stars = app.rating
            ? '⭐ ' + app.rating.toFixed(1)
            : '—';

        return `
            <div class="app-card" data-app-id="${app.id}">
                <div class="app-card-header">
                    <div class="app-card-icon">${iconContent}</div>
                    <div class="app-card-info">
                        <div class="app-card-name">${escapeHTML(app.name)}</div>
                        <div class="app-card-developer">${escapeHTML(app.developerName)}</div>
                    </div>
                </div>
                <div class="app-card-summary">${escapeHTML(app.summary)}</div>
                <div class="app-card-footer">
                    <div class="app-card-stats">
                        <span>${stars}</span>
                        <span>📥 ${formatNumber(app.downloads)}</span>
                        <span>${app.size || 'N/A'}</span>
                    </div>
                    <span class="app-card-category">${escapeHTML(app.category)}</span>
                </div>
            </div>
        `;
    }

    function bindCardClicks(container) {
        container.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', () => {
                const app = allApps.find(a => a.id === card.dataset.appId);
                if (app) openModal(app);
            });
        });
    }

    // ==================
    // APP DETAIL MODAL
    // ==================
    function openModal(app) {
        currentModalApp = app;

        // Icon
        const iconEl = document.getElementById('modal-icon');
        if (app.iconFile) {
            iconEl.innerHTML = `<img src="${app.iconFile}" alt="${app.name}">`;
        } else {
            iconEl.innerHTML = '';
            iconEl.textContent = app.icon || '📦';
        }

        document.getElementById('modal-name').textContent = app.name;
        document.getElementById('modal-developer').textContent = app.developerName;
        document.getElementById('modal-category').textContent = app.category;
        document.getElementById('modal-version').textContent = 'v' + app.version;
        document.getElementById('modal-rating').textContent = app.rating ? app.rating.toFixed(1) : '—';
        document.getElementById('modal-downloads').textContent = formatNumber(app.downloads);
        document.getElementById('modal-size').textContent = app.size || 'N/A';
        document.getElementById('modal-published').textContent = new Date(app.publishedAt).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Install button
        const installBtn = document.getElementById('modal-install-btn');
        if (app.apkFile) {
            installBtn.classList.remove('no-apk');
            installBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Install
            `;
            installBtn.onclick = () => downloadApp(app);
        } else {
            installBtn.classList.add('no-apk');
            installBtn.innerHTML = 'Not Available';
            installBtn.onclick = null;
        }

        // Share button
        document.getElementById('modal-share-btn').onclick = () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}?app=${encodeURIComponent(app.id)}`;
            if (navigator.share) {
                navigator.share({
                    title: app.name,
                    text: app.summary,
                    url: shareUrl
                });
            } else {
                navigator.clipboard.writeText(shareUrl);
                showToast('🔗', 'Link copied to clipboard!');
            }
        };

        // Reviews
        const reviewsContainer = document.getElementById('modal-reviews');
        const noReviews = document.getElementById('no-reviews');
        if (app.reviews && app.reviews.length > 0) {
            reviewsContainer.innerHTML = app.reviews.map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-user">${escapeHTML(r.user)}</span>
                        <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <p class="review-comment">${escapeHTML(r.comment)}</p>
                </div>
            `).join('');
            reviewsContainer.style.display = '';
            noReviews.style.display = 'none';
        } else {
            reviewsContainer.style.display = 'none';
            noReviews.style.display = '';
        }

        // Review Form Listener
        const reviewForm = document.getElementById('review-form');
        if (reviewForm) {
            reviewForm.onsubmit = async (e) => {
                e.preventDefault();
                if (!currentModalApp) return;

                const userInput = document.getElementById('review-user');
                const ratingInput = document.getElementById('review-rating');
                const commentInput = document.getElementById('review-comment');

                const user = userInput.value.trim();
                const rating = parseInt(ratingInput.value, 10);
                const comment = commentInput.value.trim();

                try {
                    const res = await fetch(`/api/apps/${currentModalApp.id}/reviews`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user, rating, comment })
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || 'Failed to submit review');
                    }

                    const data = await res.json();
                    showToast('⭐', 'Thank you for your review!');

                    // Update app object and modal display
                    const updatedApp = data.app;
                    currentModalApp = updatedApp;

                    const targetInAll = allApps.find(a => a.id === updatedApp.id);
                    if (targetInAll) {
                        targetInAll.rating = updatedApp.rating;
                        targetInAll.reviews = updatedApp.reviews;
                    }

                    document.getElementById('modal-rating').textContent = updatedApp.rating ? updatedApp.rating.toFixed(1) : '—';
                    openModal(updatedApp);
                    reviewForm.reset();
                } catch (err) {
                    showToast('❌', err.message);
                }
            };
        }

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        currentModalApp = null;
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // ==================
    // DOWNLOAD APP
    // ==================
    async function downloadApp(app) {
        try {
            const res = await fetch(`/api/apps/${app.id}/download`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Download failed');
            }
            const data = await res.json();

            const localApp = allApps.find(a => a.id === app.id);
            if (localApp) localApp.downloads = data.downloads;

            const downloadUrl = data.downloadUrl || `/download/${app.apkFile}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = app.name.replace(/\s+/g, '_') + '.apk';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('📥', `Downloading ${app.name}...`);
            renderAll();

            if (currentModalApp && currentModalApp.id === app.id) {
                document.getElementById('modal-downloads').textContent = formatNumber(data.downloads);
            }
        } catch (err) {
            console.error('Download error:', err);
            showToast('❌', err.message || 'Download failed. Please try again.');
        }
    }



    // ==================
    // TOAST
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

    // ==================
    // SCROLL EFFECTS
    // ==================
    window.addEventListener('scroll', () => {
        if (window.scrollY > 30) {
            navbar.style.background = 'rgba(10, 14, 26, 0.95)';
            navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.1)';
        } else {
            navbar.style.background = 'rgba(10, 14, 26, 0.85)';
            navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.08)';
        }
    });

    // ==================
    // UTILITIES
    // ==================
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

    // ==================
    // INIT
    // ==================
    fetchApps();
});
