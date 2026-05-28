const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin secret key — change this to your own secret!
const ADMIN_KEY = process.env.ADMIN_KEY || 'asquare-admin-2026';

// --- Database Helpers ---
const DB_PATH = path.join(__dirname, 'apps.json');

function readDB() {
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('[DB] Error reading apps.json:', err.message);
        return [];
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[DB] Error writing apps.json:', err.message);
    }
}

// --- Multer Storage Config ---
const apkStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = file.fieldname === 'icon'
            ? path.join(__dirname, 'public', 'uploads', 'icons')
            : path.join(__dirname, 'public', 'apps');
        // Ensure directory exists
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        // Prefix with timestamp to avoid collisions
        const prefix = Date.now() + '-';
        cb(null, prefix + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({
    storage: apkStorage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'icon') {
            // Accept only images for icons
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Icon must be an image file (JPG, PNG, etc.)'));
            }
        } else {
            // Accept any file type for APKs/projects
            cb(null, true);
        }
    }
});

// --- Middleware ---
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// GET /api/apps - Fetch all published apps
app.get('/api/apps', (req, res) => {
    const apps = readDB();
    const publishedApps = apps.filter(a => a.status === 'published');
    res.json(publishedApps);
});

// GET /api/apps/:id - Fetch single published app
app.get('/api/apps/:id', (req, res) => {
    const apps = readDB();
    const app = apps.find(a => a.id === req.params.id && a.status === 'published');
    if (!app) {
        return res.status(404).json({ error: 'App not found' });
    }
    res.json(app);
});

// POST /api/apps - Upload a new app (Default: pending review)
app.post('/api/apps', upload.fields([
    { name: 'apk', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), (req, res) => {
    try {
        const { name, category, version, summary, description, developerName, emojiIcon } = req.body;

        // Validation
        if (!name || !category || !version || !summary || !developerName) {
            return res.status(400).json({
                error: 'Missing required fields: name, category, version, summary, developerName'
            });
        }

        const apps = readDB();

        // Generate a URL-friendly ID
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

        const newApp = {
            id,
            name,
            category,
            version: version || '1.0.0',
            summary,
            description: description || summary,
            developerName,
            icon: emojiIcon || '📦',
            iconFile: null,
            apkFile: null,
            size: 'N/A',
            downloads: 0,
            rating: 0,
            reviews: [],
            screenshots: [],
            publishedAt: new Date().toISOString(),
            featured: false,
            protected: false,
            status: 'pending' // Uploaded apps must be reviewed and approved
        };

        // Handle APK file
        if (req.files && req.files.apk && req.files.apk[0]) {
            const apkFile = req.files.apk[0];
            newApp.apkFile = apkFile.filename;
            // Calculate human-readable size
            const bytes = apkFile.size;
            if (bytes >= 1024 * 1024) {
                newApp.size = (bytes / (1024 * 1024)).toFixed(1) + 'MB';
            } else {
                newApp.size = (bytes / 1024).toFixed(0) + 'KB';
            }
        }

        // Handle icon file
        if (req.files && req.files.icon && req.files.icon[0]) {
            newApp.iconFile = 'uploads/icons/' + req.files.icon[0].filename;
        }

        apps.push(newApp);
        writeDB(apps);

        console.log(`[STORE] New app submitted for review: "${name}" by ${developerName}`);
        res.status(201).json(newApp);

    } catch (err) {
        console.error('[STORE] Upload error:', err);
        res.status(500).json({ error: 'Failed to publish app', message: err.message });
    }
});

// GET /api/admin/apps - Fetch all apps (including pending) for moderation
app.get('/api/admin/apps', (req, res) => {
    const providedKey = req.headers['x-admin-key'];
    if (providedKey !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized. Admin key required.' });
    }
    const apps = readDB();
    res.json(apps);
});

// POST /api/admin/apps/:id/approve - Approve a pending app
app.post('/api/admin/apps/:id/approve', (req, res) => {
    const providedKey = req.headers['x-admin-key'];
    if (providedKey !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized. Admin key required.' });
    }

    let apps = readDB();
    const appIndex = apps.findIndex(a => a.id === req.params.id);

    if (appIndex === -1) {
        return res.status(404).json({ error: 'App not found' });
    }

    apps[appIndex].status = 'published';
    apps[appIndex].publishedAt = new Date().toISOString(); // Set release time to approval time
    writeDB(apps);

    console.log(`[STORE] App approved & published: "${apps[appIndex].name}"`);
    res.json({ message: `"${apps[appIndex].name}" has been successfully published to ASquare Store!`, app: apps[appIndex] });
});


// POST /api/apps/:id/download - Increment download count
app.post('/api/apps/:id/download', (req, res) => {
    const apps = readDB();
    const appIndex = apps.findIndex(a => a.id === req.params.id);

    if (appIndex === -1) {
        return res.status(404).json({ error: 'App not found' });
    }

    apps[appIndex].downloads = (apps[appIndex].downloads || 0) + 1;
    writeDB(apps);

    console.log(`[DOWNLOAD] ${apps[appIndex].name} — Total: ${apps[appIndex].downloads}`);

    res.json({
        downloads: apps[appIndex].downloads,
        apkFile: apps[appIndex].apkFile
    });
});

// DELETE /api/apps/:id - Delete an app (ADMIN ONLY)
app.delete('/api/apps/:id', (req, res) => {
    // Verify admin key
    const providedKey = req.headers['x-admin-key'];
    if (providedKey !== ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized. Admin key required.' });
    }

    let apps = readDB();
    const appIndex = apps.findIndex(a => a.id === req.params.id);

    if (appIndex === -1) {
        return res.status(404).json({ error: 'App not found' });
    }

    const deleted = apps[appIndex];

    // Prevent deletion of protected (seed) apps
    if (deleted.protected) {
        return res.status(403).json({ error: `"${deleted.name}" is a protected app and cannot be deleted.` });
    }

    // Clean up files
    if (deleted.apkFile) {
        const apkPath = path.join(__dirname, 'public', 'apps', deleted.apkFile);
        if (fs.existsSync(apkPath)) {
            try { fs.unlinkSync(apkPath); } catch (e) { /* ignore */ }
        }
    }
    if (deleted.iconFile) {
        const iconPath = path.join(__dirname, 'public', deleted.iconFile);
        if (fs.existsSync(iconPath)) {
            try { fs.unlinkSync(iconPath); } catch (e) { /* ignore */ }
        }
    }

    apps.splice(appIndex, 1);
    writeDB(apps);

    console.log(`[STORE] App deleted: "${deleted.name}"`);
    res.json({ message: `"${deleted.name}" has been removed.` });
});

// Legacy endpoint - backwards compatible
app.get('/api/app-info', (req, res) => {
    const apps = readDB();
    const focusmate = apps.find(a => a.id === 'focusmate');
    if (focusmate) {
        res.json({
            name: focusmate.name,
            version: focusmate.version,
            filename: focusmate.apkFile,
            size: focusmate.size,
            releaseDate: focusmate.publishedAt
        });
    } else {
        res.json({ name: "FocusMate", version: "1.0.5", filename: "app-release.apk", size: "70MB" });
    }
});

// Download file endpoint
app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'public', 'apps', req.params.filename);
    if (fs.existsSync(file)) {
        res.download(file);
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

// Multer error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`🚀 ASquare Store running at http://localhost:${PORT}`);
    console.log(`📦 Database: ${DB_PATH}`);
    console.log(`📂 Apps directory: ${path.join(__dirname, 'public', 'apps')}`);
});
