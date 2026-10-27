# Backend (apps/api)

[Tiếng Việt](vi/03-backend.md)

Express 5 + TypeScript. Grouped by feature, not by file type.

```
src/
  index.ts            starts the server, nothing else
  app.ts              builds the app (middleware + routers); tests import this directly
  config/env.ts       env vars parsed with zod; the process fails fast if one is missing
  constants/          business constants (reservation window, ledger account codes)
  db/                 Prisma client (generated into src/generated, not committed)
  lib/                small framework-free helpers (HttpError, money)
  middlewares/        current user, validation, not-found, error handler
  openapi/            OpenAPI document assembly and the /docs, /openapi.json routes
  modules/<feature>/
    <feature>.router.ts      routes -> controller
    <feature>.controller.ts  reads the request, calls the service, writes the response
    <feature>.service.ts     business logic; the only layer that touches the DB
    <feature>.schema.ts      zod schemas for input and output
    <feature>.openapi.ts     OpenAPI paths for this module, built from those schemas
test/                 mirrors src/
```

Modules: `health` (built), `users`, `events`, `listings`, `orders`, `payments`, `ledger`,
`admin` (to be built).

## Request lifecycle

```
router -> validate (zod) -> controller -> service -> db
                                   \-> throws HttpError
                                         -> errorHandler -> { error: { code, message } }
```

Every error leaves the api in the same shape:

```json
{ "error": { "code": "LISTING_SOLD_OUT", "message": "Only 1 ticket left" } }
```

`code` is stable and machine-readable (web maps it to a translated message); `message` is for
logs and developers. Unknown errors become `500 INTERNAL_ERROR` and are logged, never leaked.

Express 5 forwards rejected promises from async handlers to the error handler, so handlers
don't need try/catch.

## Current user (to be built)

No authentication, as allowed by the brief. Web sends `X-User-Id`; a middleware loads the user
and rejects unknown ids. Admin routes additionally check the role.

## API documentation (OpenAPI / Swagger)

- Swagger UI: http://localhost:4000/docs
- Raw spec: http://localhost:4000/openapi.json (OpenAPI 3.1, importable into Postman)

The spec is generated with `zod-openapi` from the same zod schemas the routes use for
validation, so documentation and behaviour cannot drift apart. Response schemas are declared
with `satisfies z.ZodType<Dto>` against the DTO types in `@tc/shared`: if the contract changes
and the schema does not, the build fails.

Adding an endpoint means: write the zod schemas in `<feature>.schema.ts`, describe the route in
`<feature>.openapi.ts`, and spread its paths into `src/openapi/document.ts`.
`test/modules/openapi.test.ts` checks the spec is served and contains every module's paths.
