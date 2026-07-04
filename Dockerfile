FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM base AS api
EXPOSE 4100
CMD ["sh", "-c", "pnpm --filter @asopulse/db db:migrate && node apps/api/dist/server.js"]

FROM base AS worker
CMD ["node", "apps/worker/dist/worker.js"]
