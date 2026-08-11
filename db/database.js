const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'apps.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const JSON_DB_PATH = path.join(__dirname, '..', 'apps.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Schema
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schemaSql);

// Migration from apps.json if database is newly initialized
function migrateFromJson() {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM apps');
    const { count } = countStmt.get();

    if (count === 0 && fs.existsSync(JSON_DB_PATH)) {
        console.log('[DB] Migrating initial data from apps.json to SQLite...');
        try {
            const raw = fs.readFileSync(JSON_DB_PATH, 'utf-8');
            const apps = JSON.parse(raw);

            if (Array.isArray(apps) && apps.length > 0) {
                const insertDev = db.prepare(`
                    INSERT OR IGNORE INTO developers (id, name, token, created_at)
                    VALUES (?, ?, ?, ?)
                `);

                const insertApp = db.prepare(`
                    INSERT OR REPLACE INTO apps (
                        id, name, category, version, summary, description,
                        developer_name, developer_id, icon, icon_file, apk_file,
                        size, downloads, rating, published_at, featured, protected, status, rejection_reason
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const insertReview = db.prepare(`
                    INSERT INTO reviews (app_id, user_name, rating, comment, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `);

                const transaction = db.transaction(() => {
                    for (const app of apps) {
                        const devId = app.developerId || 'system-admin';
                        const devName = app.developerName || 'ASquare Labs';
                        
                        insertDev.run(
                            devId,
                            devName,
                            `devtoken_${devId}`,
                            new Date().toISOString()
                        );

                        insertApp.run(
                            app.id,
                            app.name,
                            app.category || 'General',
                            app.version || '1.0.0',
                            app.summary || '',
                            app.description || app.summary || '',
                            devName,
                            devId,
                            app.icon || '📦',
                            app.iconFile || null,
                            app.apkFile || null,
                            app.size || '0KB',
                            app.downloads || 0,
                            app.rating || 0,
                            app.publishedAt || new Date().toISOString(),
                            app.featured ? 1 : 0,
                            app.protected ? 1 : 0,
                            app.status || 'pending',
                            app.rejectionReason || null
                        );

                        if (Array.isArray(app.reviews)) {
                            for (const rev of app.reviews) {
                                insertReview.run(
                                    app.id,
                                    rev.user || 'Anonymous',
                                    Math.min(5, Math.max(1, rev.rating || 5)),
                                    rev.comment || '',
                                    new Date().toISOString()
                                );
                            }
                        }
                    }
                });

                transaction();
                console.log(`[DB] Successfully migrated ${apps.length} apps to SQLite.`);
            }
        } catch (err) {
            console.error('[DB] Migration error:', err.message);
        }
    }
}

migrateFromJson();

module.exports = db;
