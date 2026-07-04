# ASOpulse

ASOpulse is an open-source, public-data-first App Store keyword workspace.
It helps you track current rankings, discover new keywords, and turn observable store data into
transparent signals without inventing search-volume metrics.

| [Overview](#overview) | [Quick Start](#quick-start) | [Local Setup](docs/local-setup.md) | [Self-Hosting](docs/self-hosting.md) | [Contributing](CONTRIBUTING.md) | [Architecture](docs/architecture.md) | [License](#license) |
| --- | --- | --- | --- | --- | --- | --- |

## Overview

ASOpulse is designed to stay calm, minimal, and traceable.

- Pulse surfaces rank movement and notable changes.
- Discover helps you research new keyword opportunities.
- Track keeps your current keywords organized and monitored.
- Settings covers schedules, retention, backup and restore, and appearance.

V1 intentionally excludes competitors, reviews, App Store Connect, Apple Ads, Google Play, teams,
billing, AI writing, and native wrappers.

## Quick Start

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm --filter @asopulse/db db:migrate
pnpm dev
```

The web app runs at `http://localhost:5173` and the API runs at `http://localhost:4100`.
Use the local setup guide for a guided development flow and the self-hosting guide for the full
Docker-based stack.

## Local Setup

For the complete developer workflow, see [docs/local-setup.md](docs/local-setup.md).
That guide covers dependencies, environment variables, PostgreSQL, Redis, migrations, and the
recommended local run loop.

## Self-Hosting

For production-style Docker hosting, see [docs/self-hosting.md](docs/self-hosting.md).
It explains how to create PostgreSQL and Redis with Compose, configure secrets, run migrations,
back up data, and expose the service safely.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
It describes the repo workflow, quality bar, and release expectations.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the monorepo layout, data flow, and product
principles.

## License

AGPL-3.0-only.
