# Security policy

## Supported versions

Security fixes are provided for the latest published minor release. Before the first stable release, only the newest `0.x` release is supported.

## Report a vulnerability

Do not disclose vulnerabilities in a public issue, discussion, pull request, or social post. Open the repository's **Security** tab and choose **Report a vulnerability** to submit a private report to the maintainer.

Include the affected version or commit, deployment model, reproduction steps, impact, and any suggested mitigation. Do not include real user data or credentials.

The maintainer will acknowledge a report within seven days, investigate it privately, and coordinate remediation and disclosure. Timelines depend on severity and reproducibility. Good-faith research that avoids privacy violations, data destruction, service disruption, and unauthorized access is welcome.

## Deployment responsibilities

Production operators must use HTTPS, a unique session secret of at least 32 characters, non-default database credentials, a strict `WEB_ORIGIN`, private PostgreSQL and Redis networking, current container images, and tested backups. Swagger UI is disabled in production unless explicitly enabled.
