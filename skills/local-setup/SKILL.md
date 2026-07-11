---
name: local-setup
description: Set up ASOpulse for local development from a fresh clone using Docker Desktop for PostgreSQL and Redis, safe local environment values, migrations, dev server startup, and health checks.
---

# ASOpulse Local Setup

Use this skill when a user asks an agent to set up ASOpulse locally from a fresh clone.

## Workflow

1. Confirm the current directory is the ASOpulse repo root.
   - Check for `package.json`, `pnpm-lock.yaml`, and `docker-compose.yml`.
   - Do not continue in a parent folder or unrelated checkout.
2. Confirm Docker Desktop is running.
   - Run `docker info` or an equivalent non-destructive check.
   - If Docker is unavailable, tell the user to start Docker Desktop and retry.
3. Prepare `.env`.
   - Copy `.env.example` to `.env` if `.env` does not exist.
   - Generate a local-only `POSTGRES_PASSWORD` and a 32+ character `SESSION_SECRET`.
   - Keep `DATABASE_URL` in sync with the generated PostgreSQL password.
   - Use development defaults for `WEB_ORIGIN` and `NODE_ENV`.
   - Never print secrets back to the user.
4. Install dependencies.
   - Prefer the repo package manager from `packageManager` in `package.json`.
   - Run `pnpm install --frozen-lockfile` when the lockfile is current.
5. Start PostgreSQL and Redis.
   - Run `docker compose up -d postgres redis`.
   - Wait for both services to be healthy before migrating.
6. Run migrations.
   - Run `pnpm --filter @asopulse/db db:migrate`.
7. Start the development server.
   - Run `pnpm dev`.
   - Keep the process running and report the web and API URLs.
8. Verify.
   - Check `http://localhost:5173` loads.
   - Check the API health endpoint or `http://localhost:4100/docs` in development.
   - If setup fails, inspect `docker compose ps`, `docker compose logs --tail=100 postgres redis`, and relevant app logs.

## Expected URLs

- Web app: `http://localhost:5173`
- API: `http://localhost:4100`
- API docs in development: `http://localhost:4100/docs`

## Safety

- Do not use production credentials for local setup.
- Do not expose PostgreSQL or Redis beyond localhost.
- Do not overwrite an existing `.env` without user approval.
- Do not run destructive database cleanup unless the user explicitly asks for a fresh reset.
