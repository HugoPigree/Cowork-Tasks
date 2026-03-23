# Task Manager API

REST API for **team / coworking** task management: **workspaces** (projets), **members** (owner / member), **tasks** with **assignee**, **creator**, filters and **ordering** (priority, due date, etc.). Stack: **Django 4.2**, **DRF**, **JWT** (**simplejwt**), **PostgreSQL**. **React + Vite** + **Tailwind** + **shadcn/ui** for the SPA (espaces, membres, tableau de tâches, thème clair/sombre).

Configuration uses **python-decouple** (`.env`). The stack is containerized with **Docker** and **Docker Compose** for the API.

## Features

- **Workspaces** (`/api/workspaces/`): create, list, update, delete (owner); **members** sub-resource (`GET/POST …/members/`, `DELETE …/members/<user_id>/` for owners)
- **Tasks** belong to a **workspace**; **`created_by`** (auto) and optional **`assignee`** (must be a workspace member); all **members** can CRUD tasks in that workspace
- **Query params** on `GET /api/tasks/`: `workspace` (recommended), `status`, `priority`, `assignee` (user id or `unassigned`), `ordering` (`-priority`, `priority`, `due_date`, `-due_date`, `created_at`, `-created_at`)
- **Registration** creates a **default personal workspace** (owner) so the UI works immediately
- **Web UI**: switch workspace, page **Espaces** (création, membres, invitations par **username**), filtres + tri priorité, cartes avec assigné / créateur
- JWT access + refresh; paginated task lists (`API_PAGE_SIZE`, default 10)

## Project layout

```
task_manager/
├── core/                  # Main Django app (models, API, permissions)
├── config/                # Project settings and root URLs
├── frontend/              # React + Vite + shadcn/ui SPA
├── deploy/                # nginx reverse-proxy example for production
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── manage.py
├── pytest.ini
├── conftest.py
└── README.md
```

## Web interface (frontend)

1. Install **Node.js 20+** and, from the repo root:

   ```bash
   cd task_manager/frontend
   npm install
   ```

2. Start the **API** on port **8000** (`runserver` or `docker compose up`).

3. Start the SPA (dev server proxies `/api` → `http://127.0.0.1:8000`):

   ```bash
   npm run dev
   ```

4. Open **http://localhost:5173** — register (un espace est créé automatiquement), invitez des membres via **Espaces**, puis gérez les tâches assignées.

### Windows PowerShell : « exécution de scripts désactivée » (`npm.ps1`)

Si `npm install` affiche une erreur **PSSecurityException** / scripts désactivés :

- **Sans changer la politique** : appelle l’exécutable CMD plutôt que le script PowerShell :

  ```powershell
  npm.cmd install
  npm.cmd run dev
  ```

- **Ou** (une fois, pour ton utilisateur) autoriser les scripts locaux signés :

  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

  Puis `npm install` fonctionnera comme d’habitude.

Optional: set `VITE_API_BASE` in `frontend/.env` if the API is on another origin — use the **origin only** (e.g. `http://localhost:8000`), not `.../api`, since request paths already include `/api/`. Ensure `CORS_ALLOWED_ORIGINS` in Django `.env` includes your dev URL (e.g. `http://localhost:5173`).

Production build: `npm run build` then `npm run preview` (preview also proxies `/api` to port 8000 by default).

> The task list pagination in the UI assumes **page size 10** (Django `API_PAGE_SIZE` default). If you change `API_PAGE_SIZE`, update the constant in `frontend/src/pages/TasksPage.tsx` accordingly.

## Quick start (Docker)

1. Copy environment file and edit secrets:

   ```bash
   cp .env.example .env
   ```

   Set `SECRET_KEY`, `DB_PASSWORD`, and (for production) tighten `ALLOWED_HOSTS`.

2. Build and run:

   ```bash
   docker compose up --build
   ```

3. Apply migrations run automatically via the `web` service command. API base URL: `http://localhost:8000/api/`.

### Browser shows “invalid response” on localhost?

The API is **HTTP only** (no TLS inside the container). Open **`http://`** explicitly, not **`https://`**. Some embedded browsers default to HTTPS and then fail against Gunicorn.

### Sprints : `404` sur `/api/workspaces/<id>/sprints/` ?

L’URL affichée dans l’UI (ex. `/api/workspaces/1/sprints/`) est **correcte** : en dev, Vite proxy envoie ça vers le serveur sur le port **8000**. Un **404** signifie presque toujours que **ce n’est pas** l’instance Django de **ce dépôt** qui répond (autre projet, ancien terminal, image Docker non reconstruite).

- En local : à la racine du repo, `python manage.py migrate` puis redémarrez `runserver`.
- Docker : `docker compose build web && docker compose up` (ou `--build`) pour inclure le dernier code ; les migrations tournent au démarrage du service `web`.

Quick check (should show JSON `{"status":"ok"}` in the browser):

`http://localhost:8000/api/health/`

This route uses Django’s `JsonResponse` (not DRF) so it still returns **200** when the browser sends `Accept: text/html`. After changing code, run `docker compose up --build` so the container picks up the latest image.

## Production deployment

The Docker image runs **Gunicorn**, **WhiteNoise** (collected `/static/` for the Django admin), and optional **serving of `/media/`** when `DJANGO_SERVE_MEDIA=true` (default in `docker-compose.yml`). User uploads persist in the **`media_data`** volume.

### Checklist

1. **`.env`** (never commit): set a strong `SECRET_KEY` (`openssl rand -base64 48`), `DB_PASSWORD`, and **`ALLOWED_HOSTS`** to your real domain(s). Django refuses the default `django-insecure-change-me-in-production` when `DEBUG=False`.
2. **`CORS_ALLOWED_ORIGINS`**: exact origins of the SPA (e.g. `https://app.example.com`).
3. **`CSRF_TRUSTED_ORIGINS`**: same-style URLs for Django **admin** over HTTPS (e.g. `https://api.example.com` if admin is used on the API host).
4. **HTTPS**: terminate TLS with **Caddy**, **Traefik**, or **nginx** in front of Gunicorn. Set `DJANGO_TRUST_X_FORWARDED_PROTO=true` (default in Compose) so Django sees `https`. Then enable `DJANGO_SESSION_COOKIE_SECURE=true` and optionally `DJANGO_SECURE_SSL_REDIRECT=true` / HSTS (`DJANGO_SECURE_HSTS_SECONDS`) once everything works.
5. **Frontend**: `cd frontend && cp .env.production.example .env.production`, set `VITE_API_BASE` to the public API origin, then `npm run build`. Serve `frontend/dist/` as static files (see `deploy/nginx.example.conf`).
6. **Scale / hardening**: for heavy traffic, set `DJANGO_SERVE_MEDIA=false` and serve `/media/` from nginx or object storage (S3-compatible); adjust Gunicorn `--workers` (e.g. `(2 × CPU) + 1`).

### Reverse proxy example

See **`deploy/nginx.example.conf`** for a TLS + SPA + `/api` proxy layout.

## Local development (without Docker)

Requires **Python 3.11+**. If `DB_NAME` is set in `.env`, **PostgreSQL** is used; if `DB_NAME` is left empty, Django falls back to **`db.sqlite3`** in the project root (handy for quick setup; use PostgreSQL for parity with Docker/production).

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS

pip install -r requirements.txt
cp .env.example .env
# Edit .env: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY, DEBUG=True for dev

python manage.py migrate
python manage.py createsuperuser   # optional — Django admin at /admin/
python manage.py runserver
```

## Authentication

After registration, obtain tokens with the login endpoint. Send the **access** token on protected routes:

```http
Authorization: Bearer <access_token>
```

Refresh the access token with the refresh endpoint (see below).

---

## API reference (all paths prefixed with `/api/`)

### Register

**`POST /api/auth/register/`** — Create a user (public).

Request body (JSON):

```json
{
  "username": "jane",
  "email": "jane@example.com",
  "password": "your-secure-password",
  "password_confirm": "your-secure-password"
}
```

Example:

```bash
curl -s -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"jane\",\"email\":\"jane@example.com\",\"password\":\"your-secure-password\",\"password_confirm\":\"your-secure-password\"}"
```

**Responses**

- `201 Created` — user created; returns `id`, `username`, `email`, and a short message.
- `400 Bad Request` — validation error (password mismatch, weak password, duplicate email, etc.).

---

### Login (JWT)

**`POST /api/auth/login/`** — Obtain access and refresh tokens (public).

```json
{
  "username": "jane",
  "password": "your-secure-password"
}
```

Example:

```bash
curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"jane\",\"password\":\"your-secure-password\"}"
```

**Responses**

- `200 OK` — `{ "access": "...", "refresh": "..." }`
- `401 Unauthorized` — invalid credentials

---

### Refresh token

**`POST /api/auth/token/refresh/`** — New access token (public; requires valid refresh).

```json
{
  "refresh": "<refresh_token>"
}
```

Example:

```bash
curl -s -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d "{\"refresh\":\"<refresh_token>\"}"
```

---

### List tasks (paginated)

**`GET /api/tasks/`** — List tasks for the authenticated user only.

Optional query parameters:

| Parameter  | Example        | Description        |
|-----------|----------------|--------------------|
| `status`  | `todo`         | Filter by status   |
| `priority`| `high`         | Filter by priority |
| `page`    | `2`            | Page number        |

Example:

```bash
curl -s "http://localhost:8000/api/tasks/?status=todo&priority=high" \
  -H "Authorization: Bearer <access_token>"
```

**Responses**

- `200 OK` — paginated payload (`count`, `next`, `previous`, `results`)
- `401 Unauthorized` — missing or invalid JWT

---

### Create task

**`POST /api/tasks/`**

```json
{
  "title": "Write README",
  "description": "Document all endpoints",
  "status": "in_progress",
  "priority": "high",
  "due_date": "2026-03-25T12:00:00Z"
}
```

`description` and `due_date` are optional. `status` defaults to `todo`, `priority` to `medium`.

Example:

```bash
curl -s -X POST http://localhost:8000/api/tasks/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Write README\",\"description\":\"Docs\",\"status\":\"in_progress\",\"priority\":\"high\"}"
```

**Responses**

- `201 Created`
- `400 Bad Request` — invalid or missing fields
- `401 Unauthorized`

---

### Retrieve task

**`GET /api/tasks/{id}/`**

```bash
curl -s http://localhost:8000/api/tasks/1/ \
  -H "Authorization: Bearer <access_token>"
```

**Responses**

- `200 OK`
- `401 Unauthorized`
- `404 Not Found` — no such task **for this user** (includes other users’ IDs)

---

### Update task (partial)

**`PATCH /api/tasks/{id}/`**

```bash
curl -s -X PATCH http://localhost:8000/api/tasks/1/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"done\"}"
```

**Responses**

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `404 Not Found` — not owned by the user

---

### Delete task

**`DELETE /api/tasks/{id}/`**

```bash
curl -s -X DELETE http://localhost:8000/api/tasks/1/ \
  -H "Authorization: Bearer <access_token>"
```

**Responses**

- `204 No Content`
- `401 Unauthorized`
- `404 Not Found` — not owned by the user

---

## Tests

Tests use **pytest** + **pytest-django** with `DJANGO_SETTINGS_MODULE=config.settings_test` (SQLite in-memory, independent of `.env` / PostgreSQL).

```bash
pip install -r requirements.txt
pytest
```

---

## Security notes

- Never commit `.env`; use `.env.example` as a template.
- The `Dockerfile` sets `DEBUG=False` by default; Compose also passes `DEBUG=False` to the web service.
- JWT secret is derived from `SECRET_KEY`; use a strong, unique value in production.

## License

MIT (or adjust for your portfolio).
