# Self-hosting

This guide is for running the full ASOpulse stack in Docker.

## 1) Prepare secrets

Copy the example environment:

```bash
cp .env.example .env
```

Then replace the placeholder values with strong secrets:

- `POSTGRES_PASSWORD`
- `SESSION_SECRET`

If you change the public web address, also update `WEB_ORIGIN`.
Keep the password in `DATABASE_URL` in sync with `POSTGRES_PASSWORD`.

## 2) Create PostgreSQL and Redis

The Compose file creates both services for you:

```bash
docker compose up -d postgres redis
```

That gives you:

- PostgreSQL on the internal Compose network
- Redis on the internal Compose network
- Named volumes for persistent data
- Local-only host bindings for `127.0.0.1:5432` and `127.0.0.1:6379`

## 3) Start the full stack

```bash
docker compose up -d --build
```

The API runs migrations on startup. The web app is exposed on port `8080`, and the API is
reachable through the internal Compose network.

## 4) Verify the install

Open:

```text
http://localhost:8080
```

If the UI loads but data is empty, confirm the API container started cleanly and that the database
migration completed.

## Backups

Back up both:

- the PostgreSQL named volume
- the portable JSON export from Settings

## Operational notes

- Run the service behind HTTPS before exposing it publicly.
- Keep `SESSION_SECRET` unique per deployment.
- Telemetry is disabled by default.
- Restore tests should be part of your maintenance routine before large upgrades.
