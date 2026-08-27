require('dotenv').config();

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

const repo = require('./db/appsRepository');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) {
    console.warn('[WARN] ADMIN_KEY environment variable not set. Set ADMIN_KEY before deploying for full security.');
}
const EFFECTIVE_ADMIN_KEY = ADMIN_KEY || 'dev-only-change-me';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];

const APPS_DIR = IS_VERCEL
    ? path.join(os.tmpdir(), 'public', 'apps')
    : path.join(__dirname, 'public', 'apps');
const ICONS_DIR = IS_VERCEL
    ? path.join(os.tmpdir(), 'public', 'uploads', 'icons')
    : path.join(__dirname, 'public', 'uploads', 'icons');
const DEV_ID_PATTERN = /^dev-[a-z0-9]+$/i;
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '200', 10);

function requireAdmin(req, res, next) {
    const providedKey = req.headers['x-admin-key'];
    if (req.session?.isAdmin === true || (providedKey && providedKey === EFFECTIVE_ADMIN_KEY)) {
        return next ? next() : true;
    }
    if (res) {
        res.status(403).json({ error: 'Unauthorized. Admin session or key required.' });
    }
    return false;
}

function requireDeveloperAuth(req, res, next) {
    const devToken = req.headers['x-dev-token'];
    const devIdParam = req.body?.developerId || req.query?.developerId;

    if (devToken) {
        const developer = repo.getDeveloperByToken(devToken);
        if (!developer) {
            return res.status(401).json({ error: 'Invalid developer token.' });
        }
        req.developer = developer;
        return next();
    }

    if (devIdParam && DEV_ID_PATTERN.test(devIdParam)) {
        const devName = req.body?.developerName || 'Developer';
        const developer = repo.ensureDeveloperExists(devIdParam, devName);
        req.developer = developer;
        return next();
    }

    return res.status(401).json({ error: 'Developer authentication required (x-dev-token header or valid developerId).' });
}

function isValidDeveloperId(id) {
    return typeof id === 'string' && DEV_ID_PATTERN.test(id);
}

function safeApkPath(filename) {
    if (!filename) return null;
    const safeName = path.basename(filename);

    const candidates = [
        path.resolve(APPS_DIR, safeName),
        path.resolve(__dirname, 'public', 'apps', safeName),
        path.resolve(process.cwd(), 'public', 'apps', safeName),
        path.resolve(__dirname, '..', 'public', 'apps', safeName)
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return path.resolve(APPS_DIR, safeName);
}

function cleanupUploadedFiles(files) {
    if (!files) return;
    for (const field of Object.values(files)) {
        for (const file of field) {
            try {
                if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (e) {
                console.warn('[STORE] Failed to cleanup file:', file.path, e.message);
            }
        }
    }
}

function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    return (bytes / 1024).toFixed(0) + 'KB';
}

// Ensure upload directories exist safely
try {
    fs.mkdirSync(APPS_DIR, { recursive: true });
    fs.mkdirSync(ICONS_DIR, { recursive: true });

    if (IS_VERCEL) {
        const bundledAppsDirs = [
            path.join(__dirname, 'public', 'apps'),
            path.join(process.cwd(), 'public', 'apps')
        ];
        for (const dir of bundledAppsDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const src = path.join(dir, file);
                    const dest = path.join(APPS_DIR, file);
                    if (fs.existsSync(src) && !fs.existsSync(dest)) {
                        try { fs.copyFileSync(src, dest); } catch (_) {}
                    }
                }
            }
        }
        const bundledIconsDirs = [
            path.join(__dirname, 'public', 'uploads', 'icons'),
            path.join(process.cwd(), 'public', 'uploads', 'icons')
        ];
        for (const dir of bundledIconsDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const src = path.join(dir, file);
                    const dest = path.join(ICONS_DIR, file);
                    if (fs.existsSync(src) && !fs.existsSync(dest)) {
                        try { fs.copyFileSync(src, dest); } catch (_) {}
                    }
                }
            }
        }
    }
} catch (err) {
    console.warn('[WARN] Could not create upload directories:', err.message);
}

// Multer Storage Config
const apkStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, file.fieldname === 'icon' ? ICONS_DIR : APPS_DIR);
    },
    filename: (req, file, cb) => {
        const prefix = Date.now() + '-';
        const safeOriginal = path.basename(file.originalname).replace(/\s+/g, '_');
        cb(null, prefix + safeOriginal);
    }
});

const upload = multer({
    storage: apkStorage,
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'icon') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Icon must be an image file (JPG, PNG, etc.)'));
            }
            return;
        }
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.apk') {
            cb(new Error('Only .apk files are allowed for app uploads'));
            return;
        }
        cb(null, true);
    }
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // static HTML uses inline styles/scripts
}));
app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));
app.use(cors({
    origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin) || IS_VERCEL) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'asquare-store-session-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Upload limit reached. Try again in an hour.' }
});

const downloadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many download requests. Please slow down.' }
});

app.use('/api', apiLimiter);

// Block direct static APK access
app.use((req, res, next) => {
    if (req.path.startsWith('/apps/') && req.path.toLowerCase().endsWith('.apk')) {
        return res.status(403).json({
            error: 'Direct APK access is disabled. Download apps through the ASquare Store.'
        });
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', environment: NODE_ENV, database: 'sqlite' });
});

// Developer Registration
app.post('/api/developer/register', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Developer name is required.' });
        }
        const devAccount = repo.registerDeveloper(name);
        console.log(`[AUTH] Developer registered: "${devAccount.name}" (${devAccount.developerId})`);
        res.status(201).json(devAccount);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Session Auth
app.post('/api/admin/login', (req, res) => {
    const { key } = req.body;
    if (key === EFFECTIVE_ADMIN_KEY) {
        req.session.isAdmin = true;
        console.log('[ADMIN] Session authenticated successfully');
        return res.json({ success: true, message: 'Logged in as admin.' });
    }
    return res.status(403).json({ error: 'Invalid admin passcode.' });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out.' });
    });
});

app.get('/api/admin/session', (req, res) => {
    res.json({ loggedIn: req.session?.isAdmin === true });
});

// GET /api/apps - Fetch published apps (with filtering, pagination, search)
app.get('/api/apps', (req, res) => {
    try {
        const includeUnavailable = req.query.includeUnavailable !== 'false';
        const category = req.query.category;
        const search = req.query.search;
        const page = req.query.page;
        const limit = req.query.limit;

        const apps = repo.getAllApps({
            status: req.query.status || 'published',
            includeUnavailable,
            category,
            search,
            page,
            limit
        });
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch apps', message: err.message });
    }
});

app.get('/api/categories', (_req, res) => {
    try {
        const categories = repo.getCategories();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories', message: err.message });
    }
});

app.get('/api/apps/:id', (req, res) => {
    const appRecord = repo.getAppById(req.params.id);
    if (!appRecord || appRecord.status !== 'published') {
        return res.status(404).json({ error: 'App not found' });
    }
    res.json(appRecord);
});

// Upload New App (Developer Auth Required)
app.post('/api/apps', uploadLimiter, upload.fields([
    { name: 'apk', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), requireDeveloperAuth, (req, res) => {
    try {
        const { name, category, version, summary, description, emojiIcon } = req.body;
        const developer = req.developer;

        if (!name || !category || !version || !summary) {
            cleanupUploadedFiles(req.files);
            return res.status(400).json({
                error: 'Missing required fields: name, category, version, summary'
            });
        }

        if (!req.files?.apk?.[0]) {
            cleanupUploadedFiles(req.files);
            return res.status(400).json({ error: 'An APK file is required.' });
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
        const apkFile = req.files.apk[0];

        const newAppData = {
            id,
            name: String(name).trim().slice(0, 120),
            category,
            version: String(version).trim().slice(0, 32) || '1.0.0',
            summary: String(summary).trim().slice(0, 280),
            description: String(description || summary).trim().slice(0, 4000),
            developerName: developer.name,
            developerId: developer.id || developer.developerId,
            icon: emojiIcon || '📦',
            iconFile: req.files.icon?.[0] ? 'uploads/icons/' + req.files.icon[0].filename : null,
            apkFile: apkFile.filename,
            size: formatFileSize(apkFile.size),
            status: 'pending'
        };

        const created = repo.createApp(newAppData);
        console.log(`[STORE] New app submitted: "${name}" by ${developer.name} (${developer.id || developer.developerId})`);
        res.status(201).json(created);
    } catch (err) {
        cleanupUploadedFiles(req.files);
        console.error('[STORE] Upload error:', err);
        res.status(500).json({ error: 'Failed to publish app', message: err.message });
    }
});

// Update App Version (Developer Auth Required)
app.put('/api/apps/:id', upload.fields([
    { name: 'apk', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]), requireDeveloperAuth, (req, res) => {
    try {
        const { version, summary, description, emojiIcon } = req.body;
        const developer = req.developer;
        const appId = req.params.id;

        const existing = repo.getAppById(appId);
        if (!existing) {
            cleanupUploadedFiles(req.files);
            return res.status(404).json({ error: 'App not found' });
        }

        if (existing.developerId !== (developer.id || developer.developerId)) {
            cleanupUploadedFiles(req.files);
            return res.status(403).json({ error: 'You are not authorized to update this app.' });
        }

        const updateData = {
            version: version ? String(version).trim().slice(0, 32) : undefined,
            summary: summary ? String(summary).trim().slice(0, 280) : undefined,
            description: description ? String(description).trim().slice(0, 4000) : undefined,
            icon: emojiIcon || undefined
        };

        if (req.files?.apk?.[0]) {
            const apkFile = req.files.apk[0];
            updateData.apkFile = apkFile.filename;
            updateData.size = formatFileSize(apkFile.size);
        }

        if (req.files?.icon?.[0]) {
            updateData.iconFile = 'uploads/icons/' + req.files.icon[0].filename;
        }

        const updated = repo.updateApp(appId, developer.id || developer.developerId, updateData);
        console.log(`[STORE] App updated: "${updated.name}" to v${updated.version}`);
        res.json(updated);
    } catch (err) {
        cleanupUploadedFiles(req.files);
        res.status(500).json({ error: err.message });
    }
});

// User Reviews API
app.post('/api/apps/:id/reviews', (req, res) => {
    try {
        const { user, rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
        }

        const updatedApp = repo.addReview(req.params.id, { user, rating, comment });
        if (!updatedApp) {
            return res.status(404).json({ error: 'App not found.' });
        }

        res.status(201).json({ message: 'Review added successfully.', app: updatedApp });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit review', message: err.message });
    }
});

// GET /api/developer/apps - Strictly scoped to authenticated developer
app.get('/api/developer/apps', requireDeveloperAuth, (req, res) => {
    const devId = req.developer.id || req.developer.developerId;
    const apps = repo.getAppsByDeveloperId(devId);
    res.json(apps);
});

// Admin endpoints
app.get('/api/admin/apps', requireAdmin, (_req, res) => {
    res.json(repo.getAllApps());
});

app.post('/api/admin/apps/:id/approve', requireAdmin, (req, res) => {
    try {
        const approved = repo.approveApp(req.params.id);
        if (!approved) {
            return res.status(404).json({ error: 'App not found' });
        }
        console.log(`[STORE] App approved: "${approved.name}"`);
        res.json({
            message: `"${approved.name}" has been published to ASquare Store!`,
            app: approved
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/admin/apps/:id/reject', requireAdmin, (req, res) => {
    try {
        const { reason } = req.body;
        const rejected = repo.rejectApp(req.params.id, reason);
        if (!rejected) {
            return res.status(404).json({ error: 'App not found' });
        }
        console.log(`[STORE] App rejected: "${rejected.name}" - Reason: ${reason || 'None'}`);
        res.json({
            message: `"${rejected.name}" submission rejected.`,
            app: rejected
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/admin/apps/:id/feature', requireAdmin, (req, res) => {
    try {
        const { featured = true } = req.body;
        const updated = repo.setFeatured(req.params.id, Boolean(featured));
        if (!updated) {
            return res.status(404).json({ error: 'App not found' });
        }
        console.log(`[STORE] App "${updated.name}" featured status changed to: ${Boolean(featured)}`);
        res.json({
            message: `App "${updated.name}" featured status updated.`,
            app: updated
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/apps/:id', requireAdmin, (req, res) => {
    try {
        const app = repo.getAppById(req.params.id);
        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }

        const deleted = repo.deleteApp(req.params.id);

        if (deleted.apkFile) {
            const apkPath = safeApkPath(deleted.apkFile);
            if (apkPath && fs.existsSync(apkPath)) {
                try { fs.unlinkSync(apkPath); } catch (_) {}
            }
        }
        if (deleted.iconFile) {
            const iconPath = path.join(__dirname, 'public', deleted.iconFile);
            if (fs.existsSync(iconPath)) {
                try { fs.unlinkSync(iconPath); } catch (_) {}
            }
        }

        console.log(`[STORE] App deleted: "${deleted.name}"`);
        res.json({ message: `"${deleted.name}" has been removed.` });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Direct streaming download for apps (used by ASquare Android app & direct client requests)
app.get('/api/apps/:id/download', downloadLimiter, (req, res) => {
    const appRecord = repo.getAppById(req.params.id);

    if (!appRecord) {
        return res.status(404).json({ error: 'App not found' });
    }
    if (appRecord.status !== 'published') {
        return res.status(403).json({ error: 'App is not available for download.' });
    }
    if (!appRecord.apkFile) {
        return res.status(404).json({ error: 'APK file not available for this app.' });
    }

    const apkPath = safeApkPath(appRecord.apkFile);
    if (!apkPath || !fs.existsSync(apkPath)) {
        return res.status(404).json({ error: 'APK file missing on server.' });
    }

    repo.incrementDownloads(req.params.id);
    res.download(apkPath, `${appRecord.name.replace(/\s+/g, '_')}-v${appRecord.version}.apk`);
});

// Download Route (JSON Response with downloadUrl for web UI)
app.post('/api/apps/:id/download', downloadLimiter, (req, res) => {
    const appRecord = repo.getAppById(req.params.id);

    if (!appRecord) {
        return res.status(404).json({ error: 'App not found' });
    }
    if (appRecord.status !== 'published') {
        return res.status(403).json({ error: 'App is not available for download.' });
    }
    if (!appRecord.apkFile) {
        return res.status(404).json({ error: 'APK file not available for this app.' });
    }

    const apkPath = safeApkPath(appRecord.apkFile);
    if (!apkPath || !fs.existsSync(apkPath)) {
        return res.status(404).json({ error: 'APK file missing on server.' });
    }

    const newDownloads = repo.incrementDownloads(req.params.id);
    console.log(`[DOWNLOAD] ${appRecord.name} — Total: ${newDownloads}`);

    res.json({
        downloads: newDownloads,
        downloadUrl: `/download/${path.basename(appRecord.apkFile)}`
    });
});

// ASquare Android Store App Info & Download
app.get('/api/store-app', (_req, res) => {
    res.json({
        name: 'ASquare Store for Android',
        version: '1.0.0',
        packageName: 'com.asquare.store',
        size: '8.4MB',
        minSdk: 'Android 7.0 (API 24)',
        downloadUrl: '/api/store-app/download'
    });
});

app.get('/api/store-app/download', downloadLimiter, (_req, res) => {
    const storeApkPath = safeApkPath('asquare-store.apk');
    if (storeApkPath && fs.existsSync(storeApkPath)) {
        return res.download(storeApkPath, 'asquare-store.apk');
    }
    // Fallback: check focusmate apk or generate friendly response
    res.redirect('/download/focusmate.apk');
});

app.get('/api/app-info', (_req, res) => {
    const focusmate = repo.getAppById('focusmate');
    if (focusmate) {
        res.json({
            name: focusmate.name,
            version: focusmate.version,
            filename: focusmate.apkFile,
            size: focusmate.size,
            releaseDate: focusmate.publishedAt
        });
    } else {
        res.json({ name: 'FocusMate', version: '1.0.5', filename: 'app-release.apk', size: '70MB' });
    }
});

app.get('/download/:filename', downloadLimiter, (req, res) => {
    const filePath = safeApkPath(req.params.filename);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath);
});

// Error handling
app.use((err, req, res, _next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origin not allowed by CORS policy.' });
    }
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`ASquare Store running at http://localhost:${PORT}`);
        console.log(`Environment: ${NODE_ENV}`);
        console.log(`Database: SQLite (${path.join(__dirname, 'db', 'apps.db')})`);
        console.log(`Apps directory: ${APPS_DIR}`);
        if (!ADMIN_KEY && !IS_PRODUCTION) {
            console.log('Dev admin key: dev-only-change-me (set ADMIN_KEY in .env)');
        }
    });
}

module.exports = app;
