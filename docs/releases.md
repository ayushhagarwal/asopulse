# Release process

Releases are maintainer-triggered and follow Semantic Versioning.

1. Confirm `main` is green and update `CHANGELOG.md`.
2. Run local tests, dependency audit, migration checks, and Docker builds.
3. Trigger the **Release** workflow with a version such as `v0.1.0-rc.1`.
4. The workflow validates the tag, reruns quality gates, creates an annotated tag and GitHub Release, publishes API/worker/web images to GHCR, scans them, and attaches provenance and SBOM information.
5. Install the prerelease with `docker-compose.release.yml` and complete smoke tests.
6. Trigger the stable version only after the release candidate passes.

Stable releases publish `vX.Y.Z`, `vX.Y`, `vX`, commit-SHA, and `latest` image tags. Prereleases publish only their exact version and commit-SHA tags. Workspace packages are never published to npm.

To withdraw a bad release, mark the GitHub Release as withdrawn, stop convenience tags from advancing, publish a fixed patch release, and document whether operators must restore a pre-upgrade database backup.
