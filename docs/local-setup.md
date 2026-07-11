# Local setup

This guide is for day-to-day development on a laptop.

## Agent-assisted setup

If you have a fresh clone and Docker Desktop is installed, you can ask Codex, Claude, or another coding agent to perform the setup for you from the repository root.

Use this prompt:

```text
Set up ASOpulse locally from this fresh clone. Use Docker Desktop for PostgreSQL and Redis, create .env from .env.example with safe local secrets, install dependencies, run migrations, start the dev server, and verify the web app and API health. Follow skills/local-setup/SKILL.md if present.
```

The reusable agent instructions are stored in [`../skills/local-setup/SKILL.md`](../skills/local-setup/SKILL.md). If your agent supports project skills, point it at that folder before starting.

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

One local-only way to generate values is:

```bash
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export SESSION_SECRET="$(openssl rand -hex 48)"
perl -0pi -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$ENV{POSTGRES_PASSWORD}|m; s|^DATABASE_URL=.*|DATABASE_URL=postgresql://asopulse:$ENV{POSTGRES_PASSWORD}\@localhost:5432/asopulse|m; s|^SESSION_SECRET=.*|SESSION_SECRET=$ENV{SESSION_SECRET}|m" .env
```

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
