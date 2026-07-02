# Self-hosting

Copy `.env.example` to `.env`, choose a long random `SESSION_SECRET` and database password, then
run `docker compose up --build`. PostgreSQL and Redis use named volumes. The web app is exposed on
port 8080 and proxies `/api` internally.

Back up both the PostgreSQL volume and the portable JSON export from Settings. Run the service
behind HTTPS before exposing it publicly. Telemetry is disabled.
