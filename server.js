const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs');

// Mock database for app versions
const appMeta = {
    name: "FocusMate",
    version: "1.0.4",
    filename: "app-release.apk",
    size: "69MB",
    releaseDate: "2024-05-15"
};

// API Endpoint for app info
app.get('/api/app-info', (req, res) => {
    res.json(appMeta);
});

// Download endpoint
app.get('/download', (req, res) => {
    const file = path.join(__dirname, 'public', 'apps', appMeta.filename);
    
    console.log(`[LOG] Download requested for ${appMeta.name} v${appMeta.version}`);
    
    // Check if the file actually exists before trying to download
    if (fs.existsSync(file)) {
        res.download(file, 'FocusMate-v1.0.4.apk'); // Send it with a nice name
    } else {
        res.status(404).json({
            error: "File not found",
            message: "The APK file is missing from the server. Please check /public/apps/"
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 ASquare Store Backend running at http://localhost:${PORT}`);
});
