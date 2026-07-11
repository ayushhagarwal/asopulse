# Contributing

Thanks for helping shape ASOpulse.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Use Issues for reproducible bugs and Discussions for support, proposals, and product ideas. Security reports must follow [SECURITY.md](SECURITY.md).

## Before you start

- Use Node 20+ and pnpm 11.8 or newer.
- Clone the repo, copy `.env.example` to `.env`, and make sure PostgreSQL and Redis are running.
- Read the docs in `docs/` before changing product behavior or architecture.
- Open an issue before substantial architectural or data-source work so the approach can be agreed first.

## Workflow

- Keep changes focused and easy to review.
- Prefer small, descriptive commits.
- Add or update tests when behavior changes.
- Keep the docs in sync with the code, especially for user-facing flows and self-hosting.

## Quality bar

Before opening a pull request, run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm audit --audit-level=high
pnpm licensecheck
```

If you change the local setup or hosting story, verify both the developer path and the Docker path.

Pull requests from non-owners require one approval and all required checks. The repository owner may merge an owner-authored pull request without another approval, but required automated checks must still pass.

## What we do not accept

ASOpulse does not accept proprietary data dumps, copied competitor assets, undisclosed scraping,
or metrics that cannot explain their source and method.

If your change introduces a new external dependency or a new data source, document why it is
needed and what users must configure.
