# Architecture

ASOpulse is a TypeScript monorepo. The Vite client communicates with a versioned Fastify API.
PostgreSQL is authoritative storage. Redis and BullMQ coordinate scheduled observations. Public
store access is isolated behind provider contracts so caching, provenance, and rate limits remain
consistent.

Every derived metric carries `source`, `observedAt`, `confidence`, and `methodVersion`.
