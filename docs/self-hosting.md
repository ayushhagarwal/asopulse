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

Set a unique database password, a random `SESSION_SECRET` of at least 32 characters, the exact HTTPS `WEB_ORIGIN`, and `NODE_ENV=production`. Then run:

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

## Reverse proxy and networking

- Terminate TLS at the reverse proxy and forward requests to the web container only.
- Preserve `Host`, `X-Forwarded-Proto`, and client IP headers.
- Never publish PostgreSQL port 5432 or Redis port 6379 to the internet.
- Set `WEB_ORIGIN` to one exact origin; do not use a wildcard.
- Leave `API_DOCS_ENABLED=false` unless API documentation must be exposed intentionally.

The API uses secure, HTTP-only, same-site cookies in production and rejects placeholder session secrets.

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
