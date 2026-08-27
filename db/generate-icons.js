const fs = require('fs');
const path = require('path');

const apps = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps.json'), 'utf8'));

// High quality gradient themes for each app
const iconThemes = {
    'fredrix-msq81iew': { bg1: '#6366f1', bg2: '#a855f7', symbol: '⚡', file: 'fredrix-icon.svg' },
    'jarvis-ai': { bg1: '#00f0ff', bg2: '#0072ff', symbol: '🤖', file: 'jarvis-icon.svg' },
    'ritika-ai': { bg1: '#ec4899', bg2: '#f43f5e', symbol: '🌸', file: 'ritika-ai-icon.svg' },
    'stodicos': { bg1: '#8b5cf6', bg2: '#3b82f6', symbol: '🕶️', file: 'stodicos-icon.svg' },
    'nexbrell': { bg1: '#f59e0b', bg2: '#ef4444', symbol: '🚀', file: 'nexbrell-icon.svg' },
    'focusmate': { bg1: '#10b981', bg2: '#06b6d4', symbol: '🧠', file: 'focusmate-icon.svg' },
    'taskflow': { bg1: '#3b82f6', bg2: '#8b5cf6', symbol: '📝', file: 'taskflow-icon.svg' },
    'codemate': { bg1: '#06b6d4', bg2: '#3b82f6', symbol: '💻', file: 'codemate-icon.svg' },
    'zenspace': { bg1: '#10b981', bg2: '#6ee7b7', symbol: '🧘', file: 'zenspace-icon.svg' },
    'dataviz': { bg1: '#f97316', bg2: '#e11d48', symbol: '📊', file: 'dataviz-icon.svg' },
    'healthsync': { bg1: '#ef4444', bg2: '#ec4899', symbol: '❤️', file: 'healthsync-icon.svg' }
};

const rootUploads = path.join(__dirname, '../uploads/icons');
const publicUploads = path.join(__dirname, '../public/uploads/icons');

fs.mkdirSync(rootUploads, { recursive: true });
fs.mkdirSync(publicUploads, { recursive: true });

for (const app of apps) {
    const theme = iconThemes[app.id] || { bg1: '#00f0ff', bg2: '#a855f7', symbol: app.icon || '📦', file: `${app.id}-icon.svg` };
    const fileName = theme.file;
    
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="grad-${app.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}" />
      <stop offset="100%" stop-color="${theme.bg2}" />
    </linearGradient>
    <filter id="glow-${app.id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="${theme.bg1}" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#grad-${app.id})" filter="url(#glow-${app.id})" />
  <rect x="4" y="4" width="248" height="248" rx="52" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4" />
  <text x="128" y="165" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif" font-size="110" text-anchor="middle">${theme.symbol}</text>
</svg>`;

    fs.writeFileSync(path.join(rootUploads, fileName), svgContent);
    fs.writeFileSync(path.join(publicUploads, fileName), svgContent);
    
    app.iconFile = `uploads/icons/${fileName}`;
}

fs.writeFileSync(path.join(__dirname, '../apps.json'), JSON.stringify(apps, null, 2));
fs.writeFileSync(path.join(__dirname, '../public/apps.json'), JSON.stringify(apps, null, 2));

console.log('Successfully generated SVG icons for all 11 apps and synced apps.json!');
