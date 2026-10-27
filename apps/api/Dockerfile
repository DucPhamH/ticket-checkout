FROM node:22-alpine
WORKDIR /app

# Install dependencies first (cached unless a package.json / lockfile changes).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @tc/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @tc/shared && npm run build -w @tc/api

EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@tc/api"]
