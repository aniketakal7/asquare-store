-- ASquare Store SQLite Schema

CREATE TABLE IF NOT EXISTS developers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    summary TEXT,
    description TEXT,
    developer_name TEXT NOT NULL,
    developer_id TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    icon_file TEXT,
    apk_file TEXT,
    size TEXT,
    downloads INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    published_at TEXT,
    featured INTEGER DEFAULT 0,
    protected INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    FOREIGN KEY(developer_id) REFERENCES developers(id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(app_id) REFERENCES apps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_developer ON apps(developer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_app ON reviews(app_id);
