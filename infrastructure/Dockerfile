FROM node:24.22.1-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm rebuild argon2 esbuild @prisma/engines prisma vue-demi && pnpm db:generate && pnpm build
RUN pnpm --filter api deploy --legacy --prod /out

FROM node:24.22.1-bookworm-slim AS api
ARG VCS_REF=development
LABEL org.opencontainers.image.source="https://github.com/mfurti/financial-tracking" \
      org.opencontainers.image.revision="$VCS_REF"
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out /app
EXPOSE 3001
ENTRYPOINT ["node", "bootstrap.mjs"]
CMD ["serve"]

FROM node:24.22.1-bookworm-slim AS web
ARG VCS_REF=development
LABEL org.opencontainers.image.source="https://github.com/mfurti/financial-tracking" \
      org.opencontainers.image.revision="$VCS_REF"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/web/.output /app/.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
