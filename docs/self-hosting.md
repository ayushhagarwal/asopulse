# Self-hosting

ASOpulse is designed to run on infrastructure you control. The supported deployment is Docker Compose behind a TLS-terminating reverse proxy.

## Requirements

- Docker Engine with Compose v2
- A DNS name and HTTPS reverse proxy for public access
- Persistent storage for PostgreSQL and Redis
- Regular database and portable JSON backups

## Source-build installation

```bash
git clone https://github.com/ayushhagarwal/asopulse.git
cd asopulse
cp .env.example .env
```

Set a unique database password, a long random `REDIS_PASSWORD`, a long random `SETUP_TOKEN`, a random `SESSION_SECRET` of at least 32 characters, the exact HTTPS `WEB_ORIGIN`, and `NODE_ENV=production`. Use a URL-safe password (for example `openssl rand -hex 24`) so `REDIS_URL` stays valid. Then run:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api worker
```

The API applies ordered migrations at startup. The web service is available on host port 8080.

## Release-image installation

Copy `.env.example` and `docker-compose.release.yml`, then pin an immutable release:

```bash
ASOPULSE_VERSION=v0.1.0 docker compose -f docker-compose.release.yml up -d
```

Do not deploy `latest` when reproducible upgrades and rollbacks matter. API, worker, and web images must use the same version.

## First owner

`POST /api/v1/auth/setup` does not accept the first anonymous caller as the owner. Set `SETUP_TOKEN` before startup and enter that same value once on the setup screen (or send it as `setupToken` / `X-Setup-Token`). The API compares the token in constant time and rejects setup when the token is missing or wrong. After an owner exists, the route stays disabled.

## Reverse proxy and networking

- Terminate TLS at the reverse proxy and forward requests to the web container only.
- Preserve `Host`, `X-Forwarded-Proto`, and the client address. The bundled nginx config sends `X-Forwarded-For` and `X-Real-IP`. The API trusts only loopback and private-network proxies when it reads that address, so a browser that reaches the API directly cannot pick its own rate-limit key.
- The bundled nginx config sends `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`. Keep those headers if you replace the bundled config.
- Never publish PostgreSQL port 5432 or Redis port 6379 to a public interface. Redis requires `REDIS_PASSWORD`. The source Compose file may bind Redis to `127.0.0.1:6379` only; the release Compose file does not publish Redis at all.
- Set `WEB_ORIGIN` to one exact origin; do not use a wildcard.
- Leave `API_DOCS_ENABLED=false` unless API documentation must be exposed intentionally.

The API uses secure, HTTP-only, same-site cookies in production. Logout clears that cookie with the same path, `Secure`, `HttpOnly`, and `SameSite` flags and deletes the server-side session. The process refuses to start when `SESSION_SECRET` is missing or is a built-in development placeholder, including when `NODE_ENV` is not `production`.

## Backups and restore

Back up both the PostgreSQL volume and the portable project export from Settings. Redis data improves queue recovery but is not a substitute for PostgreSQL backups.

Before every upgrade:

1. Read the release notes and migration notes.
2. Stop writes or schedule a maintenance window.
3. Take and verify a PostgreSQL backup.
4. Export important projects from Settings.
5. Record the currently deployed image tags.

Backups created by ASOpulse use format version 3. Version 2 remains importable.

## Upgrade and rollback

```bash
ASOPULSE_VERSION=v0.2.0 docker compose -f docker-compose.release.yml pull
ASOPULSE_VERSION=v0.2.0 docker compose -f docker-compose.release.yml up -d
```

Verify login, diagnostics, worker health, schedules, and a manual observation. Application images can be rolled back, but database migrations are not promised to be reversible. If an older application cannot read the upgraded schema, restore the pre-upgrade database backup before starting the older images.

## Operations

- Monitor API and worker logs, failed observation runs, PostgreSQL storage, and Redis memory.
- Keep the host, Docker, reverse proxy, and pinned ASOpulse version updated.
- Test restore procedures periodically.
- Use one shared Redis deployment for all API and worker processes so throttling and queues remain coordinated.
