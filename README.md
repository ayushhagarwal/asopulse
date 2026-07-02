# ASOpulse

ASOpulse is an open-source App Store keyword research and rank-monitoring workspace.
It turns public store observations into transparent, actionable signals without inventing
search-volume data.

## Status

ASOpulse is under active development. The first release covers Pulse, Discover, Watchlist,
Settings, CSV export, and self-hosting for the Apple App Store.

## Development

```bash
pnpm install
pnpm dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:4100`.
See [docs/architecture.md](docs/architecture.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

For the complete self-hosted stack:

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`. Replace the example database password and session secret before
exposing the service to a network.

## License

AGPL-3.0-only.
