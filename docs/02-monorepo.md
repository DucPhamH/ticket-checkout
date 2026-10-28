# Monorepo

[Tiếng Việt](vi/02-monorepo.md)

npm workspaces, three packages:

| Package      | Path              | Depends on         |
| ------------ | ----------------- | ------------------ |
| `@tc/shared` | `packages/shared` | nothing at runtime |
| `@tc/api`    | `apps/api`        | `@tc/shared`       |
| `@tc/web`    | `apps/web`        | `@tc/shared`       |

## The shared package

Holds only what both sides must agree on:

- fee rates and `calculateOrderAmounts()` – the buyer sees the same total on screen that the
  api sends to VNPay and posts to the ledger, because there is one implementation;
- status enums (`OrderStatus`, `EventStatus`, …);
- DTO types – if the api changes a response shape, web stops compiling.

It must stay safe to ship to the browser: no Prisma, no React, no `process.env`. ESLint
enforces this (see `packages/shared/eslint.config.mjs`).

It is compiled to `dist/` and consumed like any npm package, so build it before the apps:
`npm run build` does this in the right order.

## node_modules

npm hoists dependencies into the root `node_modules` and symlinks workspace packages
(`node_modules/@tc/shared -> packages/shared`). Node resolves imports by walking up from the
importing file, so `apps/api/src/app.ts` finds `express` in the root folder.

The catch: a package declared only by web is still reachable from api locally. That breaks
in Docker, where each image installs only its own dependencies. `import/no-extraneous-dependencies`
catches it at lint time.

## Docker builds

Each Dockerfile builds from the repo root (`context: .`) so it can see `packages/shared`.

1. Copy every `package.json` plus the lockfile. `npm ci` checks the lockfile against all
   workspaces, so the other app's manifest is needed even though its code is not.
2. `npm ci --workspace @tc/api` installs only the api's dependency tree.
3. Copy source, build shared, build the app.
4. Copy only what runs into a fresh `node:22-alpine` (multi-stage):
   - **api**: a `prod-deps` stage reinstalls with `--omit=dev --omit=optional --omit=peer`
     (`optional` matters: the lockfile marks the prisma CLI as an optional peer of `@prisma/client`),
     plus `dist/`. Migrations and the seed run in a separate one-off `migrate` service built from
     the `build` stage, which has the prisma CLI; `api` starts only after it exits successfully.
   - **web**: Next's `output: 'standalone'` traces the files the server needs (from the monorepo
     root, so `@tc/shared` is included); the image holds that tree plus `.next/static`.

Copying manifests before source keeps the install layer cached when only code changes.
`.dockerignore` excludes host `node_modules`: the image is Alpine (musl), the host is not.

Sizes on disk: api 1.26 GB → 391 MB (111 MB of it `node_modules`), web 1.72 GB → 335 MB. The
`migrate` image stays large (~1.3 GB) but only runs once, before the api. Both runtime images run as
the unprivileged `node` user. Host ports can be moved with `WEB_PORT`, `API_PORT`, `DB_PORT`.

## Scripts

```
npm run build      shared -> api -> web
npm run test       api tests (includes shared fee math)
npm run lint       all workspaces
npm run typecheck  all workspaces
npm run format     Prettier (with Tailwind class sorting)
```

## CI

`.github/workflows/ci.yml` runs on every push: format check, lint, typecheck, tests (against a
Postgres service container), production build, and `docker compose build`.

## Test database

`npm test` never touches the dev database. Vitest's global setup
(`apps/api/test/setup/global-setup.ts`) drops and recreates `tc_test` next to it, applies every
migration and seeds it, then the suite runs against that. Tests can therefore write ledger rows,
which can never be deleted, and every run starts from the same state. As a safety catch the setup
refuses to recreate any database whose name does not end in `_test`. CI uses the same mechanism
against its Postgres service.
