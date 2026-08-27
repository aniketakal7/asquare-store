const db = require('./database');

try {
    const result = db.prepare("UPDATE apps SET status = 'published'").run();
    console.log(`[OK] ${result.changes} apps marked as published.`);
} catch (e) {
    console.error('[ERROR]', e.message);
}
