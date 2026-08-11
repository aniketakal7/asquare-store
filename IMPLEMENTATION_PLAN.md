# ASquare Store — Implementation Plan (Handoff)

This document lists work **not completed** in the security/UX fix pass. Use it to continue with another coding agent or in a follow-up session.

**Completed in prior pass:** helmet, rate limiting, CORS config, path traversal fix, APK validation, atomic JSON writes, upload rollback, download tracking route, loading/error UI, deep links (`?app=id`), unlisted apps without APK, `.env.example`, README.

---

## Phase 2 — Database & Reliability (High Priority)

### 2.1 Migrate JSON → SQLite

**Why:** `apps.json` still has race conditions under heavy concurrent writes.

**Steps:**
1. Add `better-sqlite3` dependency
2. Create `db/schema.sql`:
   ```sql
   CREATE TABLE apps (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT,
     version TEXT,
     summary TEXT,
     description TEXT,
     developer_name TEXT,
     developer_id TEXT,
     icon TEXT,
     icon_file TEXT,
     apk_file TEXT,
     size TEXT,
     downloads INTEGER DEFAULT 0,
     rating REAL DEFAULT 0,
     reviews TEXT DEFAULT '[]',
     screenshots TEXT DEFAULT '[]',
     published_at TEXT,
     featured INTEGER DEFAULT 0,
     protected INTEGER DEFAULT 0,
     status TEXT DEFAULT 'pending'
   );
   ```
3. Write `db/migrate-from-json.js` to import `apps.json`
4. Replace `readDB()` / `writeDB()` in `server.js` with `db/apps.js` repository module
5. Add file locking or SQLite transactions for download count increments

**Files to touch:** `server.js`, new `db/` folder

---

## Phase 3 — Developer Authentication (High Priority)

### 3.1 Server-issued developer tokens

**Why:** Anyone can pass any `developerId` query param today.

**Steps:**
1. Add `POST /api/developer/register` — accepts `{ name }`, returns `{ developerId, token }`
2. Store developers in SQLite table `developers (id, name, token_hash, created_at)`
3. Require header `x-dev-token` on `POST /api/apps` and `GET /api/developer/apps`
4. Update `public/developer.js`:
   - On onboarding, call register API instead of local-only ID generation
   - Store token in `localStorage` as `asquare_dev_token`
   - Send token on upload and list requests
5. Migrate existing localStorage users: if old `devId` exists without token, re-register

**Acceptance criteria:**
- Cannot list another developer's apps without their token
- Cannot upload with spoofed `developerId`

---

## Phase 4 — Admin Session Hardening (Medium Priority)

### 4.1 HTTP-only session cookies

**Why:** Admin key in `sessionStorage` is visible in DevTools.

**Steps:**
1. Add `express-session` + secure cookie config
2. Add `POST /api/admin/login` — body `{ key }`, sets session on success
3. Add `POST /api/admin/logout`
4. Replace `x-admin-key` header checks with `req.session.isAdmin`
5. Update `public/admin.js` to use login endpoint instead of storing key client-side

**Production:** Set `secure: true`, `sameSite: 'strict'`, `httpOnly: true` behind HTTPS.

---

## Phase 5 — Product Features (Medium Priority)

### 5.1 App version updates

- Add `PUT /api/apps/:id` for developers (token auth)
- Allow uploading new APK for same app ID
- Keep version history optional (v2: separate `app_versions` table)

### 5.2 User reviews API

- `POST /api/apps/:id/reviews` — body `{ user, rating, comment }`
- Validate rating 1–5, sanitize text
- Recalculate average rating on insert
- Add review form in store modal (`public/script.js`)

### 5.3 Rejection reasons

- Add `POST /api/admin/apps/:id/reject` with body `{ reason }`
- Set status to `rejected` instead of hard delete (optional)
- Show reason in developer console

### 5.4 Screenshots

- Extend multer fields for `screenshots[]` (max 5)
- Display carousel in app detail modal
- Admin can preview before approve

### 5.5 Pagination & server search

- `GET /api/apps?page=1&limit=20&search=focus&category=Productivity`
- Update store browse to fetch paginated results for large catalogs

---

## Phase 6 — DevOps (Medium Priority)

### 6.1 Docker

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p public/apps public/uploads/icons
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

Create `docker-compose.yml` with volume mounts for `apps.json`, `public/apps`, `public/uploads`.

### 6.2 Automated tests

Add `jest` + `supertest`:
- `tests/api/health.test.js`
- `tests/api/apps.test.js` — list, download, upload validation
- `tests/api/admin.test.js` — auth required

Run: `npm test`

### 6.3 Backup script

`scripts/backup.sh`:
- Copy `apps.json`, `public/apps/`, `public/uploads/` to timestamped archive
- Document cron schedule in README

---

## Phase 7 — Frontend Polish (Low Priority)

| Task | File | Notes |
|------|------|-------|
| Skeleton loaders for app grid | `public/script.js`, `style.css` | Replace spinner with card skeletons |
| Empty category pills hidden | `public/script.js` | Hide categories with 0 apps |
| Developer profile = new ID | `public/developer.js` | "Switch profile" should create new dev account |
| Admin reject → reason modal | `public/admin.js` | Replace `confirm()` with modal + textarea |
| PWA manifest | `public/manifest.json` | Optional installable store |

---

## Phase 8 — Security Hardening (Ongoing)

- [ ] Virus/malware scan hook on upload (ClamAV integration)
- [ ] Content-Security-Policy headers (may require moving inline styles out of HTML)
- [ ] Audit log table for admin actions (approve, delete, reject)
- [ ] CAPTCHA on developer registration if public-facing

---

## Suggested Order for Next Agent

1. **Phase 2** (SQLite) — foundation for everything else
2. **Phase 3** (developer auth) — closes biggest auth gap
3. **Phase 6.2** (tests) — lock in behavior before more features
4. **Phase 5.1–5.3** (updates, reviews, reject reasons) — product value
5. **Phase 4** (admin cookies) — before production deploy
6. **Phase 6.1** (Docker) — deployment

---

## Verification Commands

After each phase, run:

```bash
npm install
npm run dev
curl http://localhost:3000/api/health
curl http://localhost:3000/api/apps
```

Admin test (replace key):
```bash
curl -H "x-admin-key: YOUR_KEY" http://localhost:3000/api/admin/apps
```

Upload test (requires valid dev ID + APK):
```bash
curl -X POST http://localhost:3000/api/apps \
  -F "name=Test App" \
  -F "category=Utility" \
  -F "version=1.0.0" \
  -F "summary=Test" \
  -F "developerName=Tester" \
  -F "developerId=dev-abc123" \
  -F "apk=@./sample.apk"
```

---

## Known Limitations After Fix Pass

| Item | Status |
|------|--------|
| JSON file database | Still in use — migrate in Phase 2 |
| Developer ID spoofing | Partially mitigated (format validation only) |
| Admin key in sessionStorage | Still client-side — fix in Phase 4 |
| Seed APK files not in repo | Must be placed manually in `public/apps/` |
| No automated tests | Phase 6.2 |

---

*Last updated: 2026-08-11 — handoff from initial security fix session*
