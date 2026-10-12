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
| POST | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/refresh/` | Email + password, JWT |
| GET/PATCH | `/api/auth/me/` | Name, currency, monthly budget |
| CRUD | `/api/categories/` | Name, emoji icon, colour, keywords |
| GET | `/api/categories/suggest/?note=` | Category guess for a note |
| CRUD | `/api/expenses/` | Filters: `start`, `end`, `category`, `uncategorized`, `search`, `min_amount`, `max_amount` |
| POST | `/api/expenses/quick/` | Create from one line of text |
| POST | `/api/expenses/quick/preview/` | Parse without saving (live preview) |
| POST | `/api/expenses/bulk-categorize/` | Categorise many at once |
| GET | `/api/expenses/frequent/` | One-tap repeat candidates |
| GET | `/api/stats/summary/` | Totals, by-category, daily, previous period |
