# Contributing

Thanks for helping shape ASOpulse.

## Before you start

- Use Node 20+ and pnpm 11.
- Clone the repo, copy `.env.example` to `.env`, and make sure PostgreSQL and Redis are running.
- Read the docs in `docs/` before changing product behavior or architecture.

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
```

If you change the local setup or hosting story, verify both the developer path and the Docker path.

## What we do not accept

ASOpulse does not accept proprietary data dumps, copied competitor assets, undisclosed scraping,
or metrics that cannot explain their source and method.

If your change introduces a new external dependency or a new data source, document why it is
needed and what users must configure.
