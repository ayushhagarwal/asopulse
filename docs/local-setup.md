# Local setup

This guide is for day-to-day development on a laptop.

## Requirements

- Node.js 20 or newer
- Node.js 24 is the CI and container baseline; Node.js 20+ remains supported for development.
- pnpm 11.8 or newer
- Docker Desktop, or your own PostgreSQL and Redis instances

## 1) Install dependencies

```bash
pnpm install
```

## 2) Create your local environment file

Copy the example environment and replace the secrets before you start the app:

```bash
cp .env.example .env
```

At minimum, set:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `WEB_ORIGIN` if you are not using the default Vite URL
- `NODE_ENV=development`

Keep the password in `DATABASE_URL` in sync with `POSTGRES_PASSWORD`.

## 3) Create PostgreSQL and Redis

The simplest path is to let Docker Compose create them for you:

```bash
docker compose up -d postgres redis
```

That command starts the database and cache services defined in `docker-compose.yml` and creates
their named volumes on first run.

The Compose file binds PostgreSQL to `127.0.0.1:5432` and Redis to `127.0.0.1:6379`, so the host
developer processes can reach them directly. If those ports are already in use on your machine,
either stop the existing services or point `.env` at different ports.

If you already have PostgreSQL and Redis running elsewhere, point `DATABASE_URL` and `REDIS_URL`
to those instances instead.

## 4) Run database migrations

```bash
pnpm --filter @asopulse/db db:migrate
```

## 5) Start the app

```bash
pnpm dev
```

You should then have:

- Web app: `http://localhost:5173`
- API: `http://localhost:4100`

## Useful commands

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

## Troubleshooting

- If the API cannot connect, confirm `postgres` and `redis` are healthy before rerunning the
  migration command.
- If you change schema or migration files, rerun `db:migrate` against a fresh database.
- If the UI looks stale, restart `pnpm dev` after rebuilding shared packages.
- `TRACKING_SCHEDULE` is obsolete. Configure schedule frequency, local time, and timezone per project in Settings.
