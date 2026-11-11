# CRMFinance – KIM

Vehicle finance application management platform. FastAPI backend, PostgreSQL, React + TypeScript
frontend, Dockerized. Phase 1: real auth, real API, real DB, seeded with the original dashboard
mockup data.

```
D:\Projects\CRM-Finance\
├── client/            # React 18 + Vite + TS, MUI + Tailwind, RTK Query, Recharts
├── server/            # FastAPI + SQLAlchemy 2 + Alembic, JWT + Argon2id
├── docker/            # SSL reference config
├── docs/reference/    # original static mockup (design reference)
├── docker-compose.yml
└── .env.example
```

## Quick start (Docker)

Requirements: Docker Engine with Compose v2.

```bash
# 1. configure environment
cp .env.example .env

# 2. build and start everything
docker compose up --build -d
```

The first start runs the database migration and seeds ~1,248 applications, 3 finance companies,
users, documents, notifications and activities (idempotent — repeated starts skip seeding).

Open **http://localhost** and sign in.

| Role | Email | Password (default, override via `SEED_DEFAULT_PASSWORD`) |
|---|---|---|
| Sales Executive | `sales@kim.com` | `Kim@2025` |
| Finance Officer | `finance@kim.com` | `Kim@2025` |
| Delivery Team | `delivery@kim.com` | `Kim@2025` |
| Admin | `admin@kim.com` | `Kim@2025` |

### Verify the stack

```bash
docker compose ps                 # all services healthy/running
curl http://localhost/health      # {"status":"ok",...}
curl http://localhost/docs        # Swagger UI (proxied to the API)
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sales@kim.com","password":"Kim@2025"}'
```

## Deploying on another server

1. Copy the whole repository to the server (excluding `.venv`, `node_modules`, `.git`).
2. Install Docker Engine + Compose v2 (`apt install docker.io docker-compose-v2` on Ubuntu/Debian).
3. `cp .env.example .env` and change `SECRET_KEY`, `POSTGRES_PASSWORD` and `SEED_DEFAULT_PASSWORD`.
4. `docker compose up --build -d`.
5. The `api` container runs `alembic upgrade head` + seed automatically, waits for Postgres health,
   then starts Uvicorn. The `web` container serves the SPA and reverse-proxies `/api/`, `/docs`,
   `/openapi.json`, `/redoc` and `/health` to the API.

### Persistence

`db_data` volume holds Postgres. Nothing is lost on `docker compose down`; use `docker compose down -v`
to wipe and reseed.

### Enabling HTTPS (Let's Encrypt)

Phase 1 ships plain-HTTP (default). To activate TLS:

1. Set `DOMAIN=your.domain` and `ENABLE_SSL=true` in `.env`.
2. Uncomment the `certbot` profile in `docker-compose.yml` and add the `certs`/`webroot` volumes to
   the `web` service (see `docker/nginx.ssl.conf.example`).
3. `docker compose --profile ssl up -d` and run the certbot container to obtain certificates.

## Local development

### Backend

```bash
cd server
uv venv --python 3.12 .venv          # or: python -m venv .venv
uv pip install -e ".[dev]"
$env:DATABASE_URL="postgresql+psycopg://kim:kimdev123@localhost:5432/crmfinance"   # optional
uvicorn app.main:app --reload --port 8000
```

Without `DATABASE_URL`, the API falls back to a local SQLite file (`server/dev.db`).

### Frontend

```bash
cd client
npm install
npm run dev            # http://localhost:5173, proxies /api to :8000
```

`npm run build` runs `tsc --noEmit` + `vite build`. `npm run typecheck` runs tsc only.

### Tests / lint

```bash
cd server
pytest                  # auth + dashboard + applications tests (SQLite in-memory)
ruff check app scripts tests
```

## API surface

- `POST /api/v1/auth/login` — JWT access + refresh (refresh in httpOnly cookie)
- `POST /api/v1/auth/refresh` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/me`
- `GET /api/v1/dashboard` — KPIs, pipeline counts, recent applications, needs-attention,
  waiting-on, finance company performance, nav badges, activity feed
- `GET|POST /api/v1/applications` · `GET|PATCH|DELETE /api/v1/applications/{id}`
  (paged, filterable by status/finance/date/search and `tab=all|mine|pending`, `scope=recent`)
- `POST /api/v1/integrations/omnierp/employees/webhook` — authenticated OmniERP employee created, updated, batch, and ping webhooks
- `GET /api/v1/users/me/notifications` · `PATCH …/{id}/read` · `POST …/read-all`
- Stub lists: `/documents`, `/verifications`, `/finance/submissions`, `/sanctions`,
  `/deliveries`, `/disbursements`, `/reports/summary`

Interactive docs at `/docs` (Swagger) and `/redoc`.

## OmniERP employee sync

The receiving webhook for OmniERP App Sync is:

```text
POST https://<this-app-host>/api/v1/integrations/omnierp/employees/webhook
Authorization: Bearer <shared-token>
Content-Type: application/json
```

Set `OMNIERP_EMPLOYEE_WEBHOOK_TOKEN` in the API server environment (or the deployment `.env` used by Docker Compose), then restart the API. Generate a strong token locally, for example with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Keep it private: enter the same token only in OmniERP’s App Sync settings and do not commit it or send it in chat. The endpoint rejects requests with a missing or incorrect token, and is disabled until a token is configured. Use HTTPS for any non-local deployment.

Configure OmniERP with the URL above and the shared token as a Bearer token. Its test ping can send `{"event":"test.ping","source":"Omni ERP"}`; a successful response is `{"ok":true,"event":"test.ping"}`. Employee create/update events and `employee.sync_batch` are accepted in the payload formats OmniERP supplied. Batch `count` is optional but, when supplied, must match the number of records; batches are limited to 1,000 employees.

Employees are matched case-insensitively by `employee_id` and saved to Employee Master. Names, contact details, designation, department/branch/shift names, joining date, salary, UAN, ESI number, and active status are mapped when present. Partial updates leave omitted fields unchanged; a batch does not delete records absent from the payload. After a webhook is accepted, the Employee Master view refreshes from shared app data automatically (within about 15 seconds if it is already open).

## Environment variables

| Key | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | kim / kimdev123 / crmfinance | database credentials |
| `SECRET_KEY` | dev placeholder | JWT signing key (change in prod) |
| `ACCESS_TOKEN_MINUTES` | 15 | access token lifetime |
| `REFRESH_TOKEN_DAYS` | 7 | refresh token lifetime |
| `CORS_ORIGINS` | localhost origins | allowed origins |
| `DOMAIN` / `ENABLE_SSL` | empty / false | HTTPS via Let's Encrypt |
| `WEB_PORT` | 80 | host port for the web service |
| `SEED_DEFAULT_PASSWORD` | Kim@2025 | password for seeded demo accounts |

## Deferred (later phases)

Celery workers on Redis, S3 document storage, OCR/Ollama scanning, Sentry/Zabbix monitoring,
GitHub Actions CI/CD, full CRUD workflows per section, admin RBAC UI.
