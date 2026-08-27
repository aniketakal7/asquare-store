const db = require('./database');
const crypto = require('crypto');

function formatApp(row, reviews = []) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        version: row.version,
        summary: row.summary,
        description: row.description,
        developerName: row.developer_name,
        developerId: row.developer_id,
        icon: row.icon,
        iconFile: row.icon_file,
        apkFile: row.apk_file,
        size: row.size,
        downloads: row.downloads,
        rating: row.rating,
        reviews: reviews.map(r => ({
            id: r.id,
            user: r.user_name,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.created_at
        })),
        publishedAt: row.published_at,
        featured: Boolean(row.featured),
        protected: Boolean(row.protected),
        status: row.status,
        rejectionReason: row.rejection_reason
    };
}

function getReviewsForApp(appId) {
    const stmt = db.prepare('SELECT * FROM reviews WHERE app_id = ? ORDER BY created_at DESC');
    return stmt.all(appId);
}

// --- App Repository Methods ---

function getAllApps(options = {}) {
    let sql = 'SELECT * FROM apps WHERE 1=1';
    const params = [];

    if (options.status) {
        sql += ' AND status = ?';
        params.push(options.status);
    }

    if (options.includeUnavailable !== true && options.status === 'published') {
        sql += ' AND apk_file IS NOT NULL';
    }

    if (options.category && options.category.toLowerCase() !== 'all') {
        sql += ' AND category = ?';
        params.push(options.category);
    }

    if (options.search) {
        sql += ' AND (name LIKE ? OR summary LIKE ? OR description LIKE ?)';
        const searchPattern = `%${options.search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY published_at DESC';

    if (options.limit) {
        const limit = parseInt(options.limit, 10) || 20;
        const page = parseInt(options.page, 10) || 1;
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
    }

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => {
        const reviews = getReviewsForApp(row.id);
        return formatApp(row, reviews);
    });
}

function getAppById(id) {
    const row = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);
    if (!row) return null;
    const reviews = getReviewsForApp(id);
    return formatApp(row, reviews);
}

function getAppsByDeveloperId(developerId) {
    const rows = db.prepare('SELECT * FROM apps WHERE developer_id = ? ORDER BY published_at DESC').all(developerId);
    return rows.map(row => {
        const reviews = getReviewsForApp(row.id);
        return formatApp(row, reviews);
    });
}

function createApp(appData) {
    const stmt = db.prepare(`
        INSERT INTO apps (
            id, name, category, version, summary, description,
            developer_name, developer_id, icon, icon_file, apk_file,
            size, downloads, rating, published_at, featured, protected, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        appData.id,
        appData.name,
        appData.category,
        appData.version || '1.0.0',
        appData.summary,
        appData.description || appData.summary,
        appData.developerName,
        appData.developerId,
        appData.icon || '📦',
        appData.iconFile || null,
        appData.apkFile,
        appData.size || '0KB',
        0,
        0,
        new Date().toISOString(),
        appData.featured ? 1 : 0,
        appData.protected ? 1 : 0,
        appData.status || 'pending'
    );

    return getAppById(appData.id);
}

function updateApp(id, developerId, updateData) {
    const current = getAppById(id);
    if (!current) return null;
    if (current.developerId !== developerId) {
        throw new Error('Unauthorized to update this app');
    }

    const stmt = db.prepare(`
        UPDATE apps SET
            version = COALESCE(?, version),
            summary = COALESCE(?, summary),
            description = COALESCE(?, description),
            apk_file = COALESCE(?, apk_file),
            size = COALESCE(?, size),
            icon_file = COALESCE(?, icon_file),
            icon = COALESCE(?, icon),
            status = 'pending',
            rejection_reason = NULL
        WHERE id = ? AND developer_id = ?
    `);

    stmt.run(
        updateData.version || null,
        updateData.summary || null,
        updateData.description || null,
        updateData.apkFile || null,
        updateData.size || null,
        updateData.iconFile || null,
        updateData.icon || null,
        id,
        developerId
    );

    return getAppById(id);
}

function approveApp(id) {
    const app = getAppById(id);
    if (!app) return null;
    if (!app.apkFile) {
        throw new Error('Cannot publish an app without an APK file.');
    }

    const publishedAt = new Date().toISOString();
    db.prepare(`
        UPDATE apps SET status = 'published', published_at = ?, rejection_reason = NULL WHERE id = ?
    `).run(publishedAt, id);

    return getAppById(id);
}

function rejectApp(id, reason) {
    const app = getAppById(id);
    if (!app) return null;

    db.prepare(`
        UPDATE apps SET status = 'rejected', rejection_reason = ? WHERE id = ?
    `).run(reason || 'Submission rejected by administrator', id);

    return getAppById(id);
}

function deleteApp(id) {
    const app = getAppById(id);
    if (!app) return null;
    if (app.protected) {
        throw new Error(`"${app.name}" is protected and cannot be deleted.`);
    }

    db.prepare('DELETE FROM apps WHERE id = ?').run(id);
    return app;
}

function incrementDownloads(id) {
    const result = db.prepare('UPDATE apps SET downloads = downloads + 1 WHERE id = ?').run(id);
    if (result.changes === 0) return null;
    const row = db.prepare('SELECT downloads FROM apps WHERE id = ?').get(id);
    return row ? row.downloads : null;
}

function addReview(appId, reviewData) {
    const app = getAppById(appId);
    if (!app) return null;

    const rating = Math.min(5, Math.max(1, parseInt(reviewData.rating, 10) || 5));
    const user = String(reviewData.user || 'Anonymous').trim().slice(0, 80);
    const comment = String(reviewData.comment || '').trim().slice(0, 1000);

    const insertStmt = db.prepare(`
        INSERT INTO reviews (app_id, user_name, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.run(appId, user, rating, comment, new Date().toISOString());

    // Recalculate average rating
    const avgRow = db.prepare('SELECT AVG(rating) as avgRating FROM reviews WHERE app_id = ?').get(appId);
    const newRating = avgRow && avgRow.avgRating ? Math.round(avgRow.avgRating * 10) / 10 : rating;

    db.prepare('UPDATE apps SET rating = ? WHERE id = ?').run(newRating, appId);

    return getAppById(appId);
}

// --- Developer Auth Methods ---

function registerDeveloper(name) {
    const trimmedName = String(name).trim().slice(0, 120);
    if (!trimmedName) {
        throw new Error('Developer name is required');
    }

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const developerId = `dev-${randomSuffix}`;
    const token = `devtok_${crypto.randomBytes(24).toString('hex')}`;
    const createdAt = new Date().toISOString();

    db.prepare(`
        INSERT INTO developers (id, name, token, created_at)
        VALUES (?, ?, ?, ?)
    `).run(developerId, trimmedName, token, createdAt);

    return { developerId, name: trimmedName, token, createdAt };
}

function getDeveloperByToken(token) {
    if (!token) return null;
    return db.prepare('SELECT * FROM developers WHERE token = ?').get(token);
}

function getDeveloperById(id) {
    if (!id) return null;
    return db.prepare('SELECT * FROM developers WHERE id = ?').get(id);
}

function ensureDeveloperExists(id, name) {
    const existing = getDeveloperById(id);
    if (existing) return existing;

    const syntheticToken = `devtoken_${id}`;
    db.prepare(`
        INSERT OR IGNORE INTO developers (id, name, token, created_at)
        VALUES (?, ?, ?, ?)
    `).run(id, name, syntheticToken, new Date().toISOString());

    return getDeveloperById(id);
}

function claimApp(appId, developerId, developerName) {
    const stmt = db.prepare('UPDATE apps SET developer_id = ?, developer_name = ? WHERE id = ?');
    stmt.run(developerId, developerName, appId);
    return getAppById(appId);
}

function setFeatured(id, featured = true) {
    const app = getAppById(id);
    if (!app) return null;
    db.prepare('UPDATE apps SET featured = ? WHERE id = ?').run(featured ? 1 : 0, id);
    return getAppById(id);
}

function getCategories() {
    const rows = db.prepare(`
        SELECT DISTINCT category FROM apps
        WHERE category IS NOT NULL AND status = 'published'
        ORDER BY category ASC
    `).all();
    return rows.map(r => r.category);
}

module.exports = {
    getAllApps,
    getAppById,
    getAppsByDeveloperId,
    createApp,
    updateApp,
    approveApp,
    rejectApp,
    deleteApp,
    incrementDownloads,
    addReview,
    registerDeveloper,
    getDeveloperByToken,
    getDeveloperById,
    ensureDeveloperExists,
    claimApp,
    setFeatured,
    getCategories
};
