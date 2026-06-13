# RVCE Connect (PWA)

The official unified notice board for **RV College of Engineering** — a mobile-first Progressive Web App built with **HTML, CSS, Bootstrap 5, vanilla JavaScript, Node.js (Express) and MySQL** (no SPA framework).

## Features

- 🎓 **Three roles** — `admin`, `publisher` (faculty / dept / club heads), `viewer` (student). Self-registration always creates a **viewer**; only an admin can **promote** to publisher.
- 🔐 **JWT auth**. Banned users are blocked at login with a clear "You are banned." message.
- 📝 **Posting** — publishers/admins compose a post with a required **Post From Community** and an optional **Expires On** (auto-remove) date. Publishers can post from any community they **own or have joined**; admins can also broadcast college-wide. **Only admins can delete posts** (deletions are audit-logged).
- 🌐 **Communities are public** — viewers **Subscribe** to a community to get its posts in their feed; a per-community **🔔 bell** is a separate opt-in for **push notifications**. Unsubscribe any time.
- 🔔 **Real Web Push (VAPID)** — bell-on registers a browser push subscription; new posts notify bell-enabled subscribers of that community.
- ❤️ Viewers can **like** posts (toggle, one per user per post).
- 🛠️ **Admin panel** — stats, member directory with **search**, ban/promote, **create/delete communities** (a new department or club + its channel, with an optional **custom logo**), and a read-only **archived posts** viewer.
- ⏳ **Auto-archiving** — expired posts are moved to an `expired_posts` table by a 15-minute background job and hidden from feeds.
- 📱 **PWA** — installable `manifest.json` (26 fields, shortcuts, share target), service worker with **Cache-First** shell, **Network-First** API, and a **Background Sync** queue for offline publisher posts. Offline fallback page included.
- 🌓 **Unified light/dark theme** with a persistent toggle on every page.

## Project structure

```
campus-connect/
├── server.js                 # Express entry, schema bootstrap, JS migrations, expiry job
├── db.js                     # MySQL pool (UTC timezone)
├── package.json
├── .env.example              # Copy to .env and fill in (incl. VAPID keys)
├── docker-compose.yml        # MySQL 8 (host port 3307)
├── db/
│   └── schema.sql            # 12-table schema + idempotent seed data
├── middleware/
│   └── auth.js               # JWT verification & role guards
├── scripts/
│   ├── init-db.js
│   └── expire-posts.js       # Archive expired posts (run every 15 min)
├── routes/
│   ├── auth.js               # register (viewer), login, me
│   ├── users.js              # user management
│   ├── channels.js           # communities, subscribe/unsubscribe, bell
│   ├── posts.js              # feed, create, admin-delete, like
│   ├── subscriptions.js
│   ├── admin.js              # stats, users, community CRUD, archive
│   ├── push.js               # Web Push (VAPID) + fan-out
│   ├── clubs.js
│   └── departments.js
└── public/                   # PWA frontend
    ├── index.html            # Login / register
    ├── app.html              # Main app (adapts to role)
    ├── offline.html          # Offline fallback
    ├── manifest.json
    ├── service-worker.js     # Hybrid cache + background sync + push
    ├── css/styles.css        # Token-driven light/dark theme
    ├── icons/                # icon-72…512 + screenshots
    └── js/
        ├── api.js            # fetch wrapper (get/post/patch/del) with JWT
        ├── login.js
        ├── app.js            # main client controller
        ├── theme.js          # light/dark theme controller
        └── sw-register.js    # SW registration + IndexedDB queue
```

## Getting started

### 1. Prerequisites
- **Node.js 18+**
- **MySQL 8** — easiest via Docker: `docker compose up -d db` (runs MySQL on host port **3307**)

### 2. Install
```bash
cd campus-connect
npm install
```

### 3. Configure
```bash
cp .env.example .env
```
Edit `.env`: MySQL credentials, a long random `JWT_SECRET`, and a **VAPID keypair** for push:
```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
Put the values in `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (and set `VAPID_SUBJECT`). If left blank, the app runs fine but push is disabled.

### 4. Run
```bash
npm start        # or: npm run dev  (nodemon)
```
On first launch the server creates the schema from `db/schema.sql`, runs idempotent column migrations, seeds sample data, and creates a default admin (`admin / admin123` unless changed in `.env`).

Open <http://localhost:3000> and log in.

> ⚠️ Change the default admin password before any real use.

## How to use it

### As **admin**
1. Log in with `admin / admin123`.
2. **Dashboard** tab → view stats, search/ban/promote members, and manage **Communities** (Add creates a new department/club + channel with an optional logo; trash removes one and re-homes its posts to college-wide). Browse the **Archived Posts** panel.

### As **publisher**
1. Log in — you land on the **Post** tab by default.
2. Pick a **Post From Community** (any community you own or have joined), optionally set an **Expires On** date, and Publish.
3. **Communities** tab → Subscribe to more communities to be able to post from them.

### As **viewer** (student)
1. Register (you're a viewer) or log in.
2. **Feed** → newest-first posts; like with ❤️.
3. **Communities** → **Subscribe** to add a community's posts to your feed; tap the **🔔 bell** to also receive push notifications.

## PWA / Offline / Push

- Installable on Chrome/Edge/Android (and iOS 16.4+ once added to the Home Screen).
- Service worker: Cache-First app shell, Network-First `/api/posts` & `/api/channels` (with cached fallback), Background Sync for posts created offline by publishers, and an `/offline.html` fallback.
- **Web Push requires a secure context** — it works on `https://` or `localhost`. On a phone over plain `http://<LAN-IP>` the bell will report the insecure context; use HTTPS (e.g. a tunnel) or install the PWA.

## API summary

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | Create a viewer (@rvce.edu.in) |
| POST | `/api/auth/login` | anyone | Get JWT (banned → 403) |
| GET | `/api/auth/me` | authed | Current user |
| GET | `/api/posts` | authed | Feed (newest-first, expired hidden; `?mine=1` for own history) |
| POST | `/api/posts` | publisher/admin | New post (multipart) → fires push |
| POST | `/api/posts/:id/like` | authed | Toggle like |
| DELETE | `/api/posts/:id` | **admin only** | Delete (audit-logged) |
| GET | `/api/channels` | authed | Communities + my status + bell + logo |
| POST | `/api/channels/:id/subscribe` | authed | Subscribe |
| DELETE | `/api/channels/:id/subscribe` | authed | Unsubscribe |
| PATCH | `/api/channels/:id/bell` | authed | Toggle push opt-in |
| GET | `/api/push/vapid-public-key` | authed | Public VAPID key |
| POST | `/api/push/subscribe` | authed | Store push endpoint |
| POST | `/api/admin/communities` | admin | Create dept/club + channel (+logo) |
| DELETE | `/api/admin/communities/:id` | admin | Delete community |
| GET | `/api/admin/expired-posts` | admin | Archived posts |
| GET | `/api/admin/stats` | admin | Dashboard counters |
| POST | `/api/admin/users/:id/ban` · `/role` | admin | Ban / promote |
| GET | `/api/users` · POST · DELETE | admin | Manage users |
| GET | `/api/clubs` · `/api/departments` | authed | Lookups |

## Notes / things you can extend

- **Real-time chat, academic calendar, placement RSVPs, post analytics, Kannada i18n** are future scope (see `PRD.md`); their tables are not in the current schema.
- **Bookmarks** route/table exist but the UI control was intentionally removed.
- For production: serve over HTTPS, keep MySQL on a private network, rotate the VAPID keys, and change default credentials.
