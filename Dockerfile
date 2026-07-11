FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm --filter @asopulse/api --prod deploy /out/api --legacy \
  && pnpm --filter @asopulse/worker --prod deploy /out/worker --legacy

FROM gcr.io/distroless/nodejs24-debian13:nonroot AS api
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /out/api/ .
EXPOSE 4100
CMD ["dist/container.js"]

FROM gcr.io/distroless/nodejs24-debian13:nonroot AS worker
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /out/worker/ .
CMD ["dist/worker.js"]
