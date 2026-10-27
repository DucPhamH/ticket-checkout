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

Copying manifests before source keeps the install layer cached when only code changes.
`.dockerignore` excludes host `node_modules`: the image is Alpine (musl), the host is not.

Known gap: images are single-stage and keep build tooling (api ~500 MB, web ~1.3 GB). A
multi-stage build with Next's `output: 'standalone'` would bring both to roughly 200 MB.

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
