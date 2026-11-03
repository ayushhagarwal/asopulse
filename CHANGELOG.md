# Changelog

All notable changes are documented here. ASOpulse follows [Semantic Versioning](https://semver.org/) while its public APIs and backup formats remain pre-1.0.

## [Unreleased]

### Security

- Require `SETUP_TOKEN` before the first owner can be created, and keep setup disabled once a user exists.
- Require a session for app search, keyword discovery, and diagnostics.
- Cap search terms and the in-memory provider cache, and evict expired cache entries.
- Forward the client address from nginx and trust only private or loopback proxies for rate limits.
- Store a server-side session id that logout deletes, and clear the cookie with the same flags used at login.
- Prefix spreadsheet formula cells in CSV export.
- Require `REDIS_PASSWORD` and do not publish Redis on a public interface.
- Refuse to start the exposed API when `SESSION_SECRET` is missing or is a built-in development value.
- Send `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` from nginx.

### Added

- Public-release documentation, governance, security automation, and container release workflow.
- Table-first keyword tracking, queued refreshes, per-project schedules, and independent market datasets.

## [0.1.0] - Unreleased

Initial public self-hosted release.

[Unreleased]: https://github.com/ayushhagarwal/asopulse/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ayushhagarwal/asopulse/releases/tag/v0.1.0
