# Running and logs

[Tiếng Việt](vi/running.md)

## Two ways to run

|              | Everything in Docker                        | Dev mode (hot reload)                                                                                              |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Start        | `docker compose up -d --build`              | `npm run dev:db`, then `npm run dev` (shared + api + web in one terminal, prefixed `[shared]` / `[api]` / `[web]`) |
| Code changes | rebuild: `docker compose up -d --build api` | picked up automatically                                                                                            |
| Logs         | `docker compose logs -f api`                | printed in each terminal                                                                                           |
| Use for      | what reviewers run; checking the real build | day-to-day development                                                                                             |

Both use port 4000 for the api and 3000 for web, so stop the Docker service before running the
same one in dev mode: `docker compose stop api`.

## Dev mode step by step

```bash
docker compose stop api web   # free ports 4000 and 3000 if the Docker versions are running
npm run dev:db                # Postgres in Docker (the only thing dev mode needs from Docker)
npm run dev                   # shared (rebuilt on save), api on :4000, web on :3000; all reload on save
# Ctrl+C stops both
```

Run `npm run dev:api` or `npm run dev:web` instead to get each in its own terminal.

`npm run dev` also recompiles `packages/shared` on save. The apps import its compiled output
(`dist/`), not `src/`, so with `dev:api` / `dev:web` alone a change to shared is not picked up
until `npm run build -w @tc/shared`. After changing `schema.prisma`, run
`npm run db:migrate -w @tc/api`.

Where `console.log` shows up: code that runs on the server (api, Server Components) prints in the
terminal; code in a `'use client'` component prints in the **browser** DevTools console.

## Docker commands

```bash
docker compose ps                      # what is running, health
docker compose logs -f api             # follow api logs (Ctrl+C to stop following)
docker compose logs --tail 50 api      # last 50 lines
docker compose logs --since 10m web    # last 10 minutes
docker compose logs -f                 # every service, interleaved
docker compose restart api             # restart without rebuilding
docker compose up -d --build api       # rebuild after code changes
docker compose down                    # stop everything (data is kept in the db volume)
```

## Api logs

One line per request, from `pino-http` (`apps/api/src/middlewares/request-logger.ts`):

```
[04:18:09.476] INFO: GET /events 200 63ms {"req":{"id":"ac47aa08-..."}}
[04:18:09.488] INFO: GET /me 200 6ms {"req":{"id":"5eec7265-...","userId":"1"}}
[04:18:09.504] WARN: GET /events/999 404 9ms {"req":{"id":"946c3bbe-..."}}
[04:18:09.519] WARN: GET /me 401 1ms {"req":{"id":"2709732a-..."}}
```

- Level follows the outcome: `INFO` for 2xx/3xx, `WARN` for 4xx, `ERROR` for 5xx. Unexpected
  errors also log the stack trace.
- Every request has an id, returned in the `X-Request-Id` response header. Search the logs for it
  to find one request.
- `/health` is not logged: Docker calls it every few seconds.
- Readable lines in development, JSON when `NODE_ENV=production`, silent in tests.

Settings (in `.env`):

| Variable    | Default | Effect                                                                      |
| ----------- | ------- | --------------------------------------------------------------------------- |
| `LOG_LEVEL` | `info`  | `debug` for more, `warn` for less                                           |
| `LOG_SQL`   | `false` | `true` prints every SQL statement Prisma runs, with parameters and duration |

```bash
LOG_SQL=true npm run dev:api                       # dev mode
LOG_SQL=true docker compose up -d api              # Docker (reads the variable from the shell or .env)
```

## Web logs

Next.js prints each page request in its terminal or in `docker compose logs -f web`:

```
GET /vi/events/1 200 in 120ms
```

Pages fetch from the api **on the server**, so those api calls appear in the api logs, not in the
browser's DevTools Network tab. The browser only sees requests to web.

## Database

```bash
npm run db:studio -w @tc/api                       # browse tables in the browser
docker compose exec db psql -U tc -d tc            # SQL prompt (\q to quit)
docker compose logs -f db                          # Postgres server log
```
