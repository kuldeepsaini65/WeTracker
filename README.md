# WeTracker

Expense tracker built around **fast entry**: if logging takes more than a couple of seconds, people stop doing it.

| Part | Stack | Folder |
|---|---|---|
| API | Django 4.2 · DRF · JWT · Swagger (drf-spectacular) | `backend/` |
| Web (all devices) | React 19 · Vite · TypeScript · Tailwind v4 · TanStack Query · Recharts | `web/` |
| Android | Flutter (Material 3) | `mobile/` |

## Quick add — how it stays fast

- **One line, Enter.** `250 coffee`, `uber 180`, `1.2k groceries yesterday`, `99 netflix #entertainment`.
  The first number is the amount (`₹`, `rs`, `k` supported), `#tag` picks a category, `today`/`yesterday` backdate.
- **Auto category.** Guessed from how you categorised the same note before, then from category keywords.
  No match? It's saved as **Uncategorized** — never blocks you.
- **Inbox.** Uncategorized expenses collect here; select some (or none = top one) and tap a category.
- **One-tap repeats.** Your most frequent expenses (last 90 days) as chips.
- **Web:** press `N` or `/` anywhere; installable as a PWA with an "Add expense" shortcut.
- **Android:** opens straight to an on-screen keypad (toggle in Settings), long-press the app icon → *Add expense*,
  and entries are queued **offline** and synced later (server de-duplicates by `client_id`).

## Seniors and their users

- **Senior** — signs up as "I'm a senior" (or taps *Become a senior* in Settings) and gets an 8-character **invite code**
  (plus a shareable link `https://<web>/?invite=CODE`).
- **User** — enters the code at sign-up or later in Settings. From then on:
  - the senior can **see all of their expenses** (read-only) on the **Team** page / tab: totals per person and per category,
    daily chart, a filterable feed, and a members table;
  - the user picks from the **senior's category list** (they can't edit it). On joining, their existing expenses are matched
    to the senior's categories by name; the rest go to their Inbox.
- Users can **leave**; seniors can **remove** a user or **regenerate** the code. Either way the user gets default categories back.
- Accounts without a senior work as **personal** accounts, unchanged.

## Run it

### Backend
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 0.0.0.0:8000
```
- Swagger UI: http://localhost:8000/api/docs/ · ReDoc: `/api/redoc/` · OpenAPI: `/api/schema/`
- Tests: `.venv/bin/python manage.py test`
- Default categories/keywords live in `backend/expenses/defaults.py` (English + Hinglish). After editing, update existing
  accounts with `.venv/bin/python manage.py sync_default_categories` (add `--dry-run` to preview). User-created categories are never touched.
- Production env vars: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.

### Web
```bash
cd web
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8000)
npm run build      # set VITE_API_URL=https://api.example.com for a separate API host
```

### Android
```bash
cd mobile
flutter run                                          # emulator → uses http://10.0.2.2:8000
flutter run --dart-define=API_URL=http://192.168.x.x:8000   # real phone on same Wi-Fi
flutter build apk --release --dart-define=API_URL=https://api.example.com
```

## API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/refresh/` | Email + password, JWT. Register takes `account_type` (`personal`/`senior`) or `invite_code` |
| GET/PATCH | `/api/auth/me/` | Name, currency, monthly budget |
| CRUD | `/api/categories/` | Name, emoji icon, colour, keywords |
| GET | `/api/categories/suggest/?note=` | Category guess for a note |
| CRUD | `/api/expenses/` | Filters: `start`, `end`, `category`, `uncategorized`, `search`, `min_amount`, `max_amount` |
| POST | `/api/expenses/quick/` | Create from one line of text |
| POST | `/api/expenses/quick/preview/` | Parse without saving (live preview) |
| POST | `/api/expenses/bulk-categorize/` | Categorise many at once |
| GET | `/api/expenses/frequent/` | One-tap repeat candidates |
| GET | `/api/stats/summary/` | Totals, by-category, daily, previous period |
| GET | `/api/team/` | Seniors: invite code + members with this month's totals. Users: their senior |
| POST | `/api/team/become-senior/`, `/api/team/regenerate-code/` | Senior setup |
| POST | `/api/team/join/`, `/api/team/leave/` | Join / leave with an invite code |
| DELETE | `/api/team/members/{id}/` | Senior removes a user |
| GET | `/api/team/expenses/` | Seniors: every team expense, read-only (`member=` filter) |
| GET | `/api/team/summary/` | Seniors: team totals, by person, by category, daily |

## Auto-deploy (GitHub Actions)

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main`:

1. **Test** (in parallel): backend checks + unit tests + Swagger validation · web type-check + build · Flutter analyze + tests.
2. **Deploy** — only if every test passed: uploads the backend over SSH, installs requirements, backs up `db.sqlite3`
   (keeps the last 10 in `backups/`), runs `makemigrations` + `migrate` + `collectstatic`, restarts the service, uploads the
   website, then smoke-tests the live site. Pull requests run the tests only.

The deploy never touches the server's database, `.venv`, `.env`, `staticfiles/` or `migrations/`.

### One-time setup

**1. A deploy key** (on your Mac):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/wetracker_deploy -N "" -C "github-actions-deploy"
ssh-copy-id -i ~/.ssh/wetracker_deploy.pub YOUR_USER@YOUR_SERVER
```

**2. Let that user restart the app without a password** (on the server, `sudo visudo -f /etc/sudoers.d/wetracker`):
```
YOUR_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart YOUR_SERVICE, /usr/bin/journalctl -u YOUR_SERVICE *
```

**3. GitHub → repo → Settings → Secrets and variables → Actions**

| Secrets | Value |
|---|---|
| `SSH_PRIVATE_KEY` | contents of `~/.ssh/wetracker_deploy` (the file **without** `.pub`) |
| `SSH_HOST` | server IP or hostname |
| `SSH_USER` | `YOUR_USER` |

| Variables | Example |
|---|---|
| `BACKEND_DIR` | `/var/www/wetracker/backend` — the folder with `manage.py` |
| `WEB_DIR` | `/var/www/wetracker/web` — the folder nginx serves; must contain **only** the website |
| `SERVICE_NAME` | `wetracker` — the systemd service running Django/gunicorn |
| `SSH_PORT` *(optional)* | `22` |
| `VENV_DIR` *(optional)* | defaults to `BACKEND_DIR/.venv` |

**4. nginx** must send unknown paths to the web app, so `/privacy`, `/settings` etc. load:
```nginx
location / { root /var/www/wetracker/web; try_files $uri /index.html; }
```

**5. (Optional) approve each deploy**: Settings → Environments → `production` → Required reviewers.

Default categories are **not** re-synced on deploy (that would restore categories people deleted). After editing
`defaults.py`, run `python manage.py sync_default_categories` on the server once.
