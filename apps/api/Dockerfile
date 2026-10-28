# Multi-stage build: compile with every dependency, ship only what runs.

# ---- build: all dependencies, then compile shared + api ----
FROM node:22-alpine AS build
WORKDIR /app
# Dependencies first, so this layer is cached unless a package.json / the lockfile changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @tc/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# prisma generate reads the config, which requires DATABASE_URL; it does not connect.
RUN npm run build -w @tc/shared && DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build -w @tc/api

# ---- migrate: one-off job run by compose before the api starts ----
# Reuses the build stage, which has the prisma CLI. The CLI (with Prisma Studio, its UI) is
# ~200 MB the api never needs at runtime, so it stays out of the runtime image.
FROM build AS migrate
WORKDIR /app/apps/api
CMD ["npm", "run", "migrate:docker"]

# ---- prod-deps: runtime dependencies only (no TypeScript, vitest, eslint...) ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @tc/api --omit=dev --omit=optional --omit=peer && npm cache clean --force

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 4000
# Migrations and the seed already ran in the "migrate" service (see docker-compose.yml).
CMD ["node", "dist/index.js"]
