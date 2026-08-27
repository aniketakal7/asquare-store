const fs = require('fs');
const path = require('path');
const repo = require('./database');

try {
    const db = require('./database');
    const appsRepo = require('./appsRepository');
    const allApps = appsRepo.getAllApps({ includeUnavailable: true });

    const formatted = JSON.stringify(allApps, null, 2);
    fs.writeFileSync(path.join(__dirname, '..', 'apps.json'), formatted);
    fs.writeFileSync(path.join(__dirname, '..', 'public', 'apps.json'), formatted);

    console.log(`[SYNC] Successfully exported ${allApps.length} apps to apps.json and public/apps.json!`);
} catch (e) {
    console.error('[SYNC ERROR]', e);
}
