# Multi-stage build: Next's "standalone" output holds only the files the server needs.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @tc/web --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @tc/shared && npm run build -w @tc/web

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# The standalone tree mirrors the monorepo (traced from the repo root), with a minimal node_modules.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
# Static assets are not part of standalone; serve them from the expected place.
COPY --from=build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
