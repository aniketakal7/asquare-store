# ASquare Store

Self-hosted Android app marketplace with a public store, developer upload console, and admin moderation portal.

## Quick Start

```bash
cp .env.example .env
# Edit .env — set ADMIN_KEY to a long random secret

npm install
npm run dev
```

Open:

- Store: http://localhost:3000
- Developer Console: http://localhost:3000/developer.html
- Admin Portal: http://localhost:3000/admin.html

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_KEY` | Yes (production) | Secret for admin API and portal |
| `PORT` | No | Server port (default `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `MAX_UPLOAD_MB` | No | Max APK size in MB (default `200`) |

**Development:** If `ADMIN_KEY` is unset, the dev fallback is `dev-only-change-me`.

## Project Structure

```
server.js          Express API + static hosting
apps.json          App catalog (JSON database)
public/
  index.html       Store frontend
  developer.html   Developer upload console
  admin.html       Admin moderation
  apps/            APK files (gitignored)
  uploads/icons/   App icons (gitignored)
```

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/apps` | — | List published apps with APK |
| GET | `/api/apps/:id` | — | Single app details |
| POST | `/api/apps` | dev ID | Upload new app (pending review) |
| GET | `/api/developer/apps?developerId=` | dev ID format | Developer's submissions |
| GET | `/api/admin/apps` | `x-admin-key` | All apps for moderation |
| POST | `/api/admin/apps/:id/approve` | `x-admin-key` | Publish pending app |
| DELETE | `/api/apps/:id` | `x-admin-key` | Delete / reject app |
| POST | `/api/apps/:id/download` | — | Track download + get URL |
| GET | `/download/:filename` | — | Download APK file |

## Security Notes

- Direct `/apps/*.apk` access is blocked; downloads go through `/download/`.
- APK uploads must use `.apk` extension.
- Rate limiting is enabled on API, uploads, and downloads.
- Set a strong `ADMIN_KEY` before any public deployment.
- Developer IDs are client-generated (`dev-xxxx`) — see `IMPLEMENTATION_PLAN.md` for proper auth.

## Production Checklist

- [ ] Set `ADMIN_KEY` and `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGINS` to your domain
- [ ] Use HTTPS (reverse proxy: nginx, Caddy, etc.)
- [ ] Back up `apps.json` and upload directories regularly
- [ ] Place APK files in `public/apps/` for seed apps

## Remaining Work

See **`IMPLEMENTATION_PLAN.md`** for features not yet implemented (SQLite migration, developer auth, reviews API, etc.).
