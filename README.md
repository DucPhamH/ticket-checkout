# Ticket checkout with escrow

A thin slice of an event-ticket resale marketplace: a buyer picks a listing, pays through the
VNPay sandbox, and the money is held in escrow until the event is marked completed. Every money
movement is recorded in a double-entry ledger.

> Work in progress. This README grows into the full deliverable (setup, gateway choice,
> decisions, limitations, AI usage) as the project is built.

## Stack

TypeScript everywhere. Next.js 16 (server-rendered UI), Express 5 (api), PostgreSQL 16,
npm workspaces, Docker Compose. UI in Vietnamese and English.

## Run it

Requirements: Docker. For development outside Docker, Node 22 (see `.nvmrc`).

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000
- Api: http://localhost:4000/health
- API docs (Swagger): http://localhost:4000/docs

## Development

```bash
npm install
npm run dev:db         # Postgres in Docker
npm run build -w @tc/shared
npm run dev            # shared (watch) + api :4000 + web :3000, reload on save

docker compose logs -f api   # api request logs (see docs/running.md)

npm run lint && npm run typecheck && npm test
npm run format
```

## Architecture

See [docs/](docs/README.md): overview, monorepo, backend, frontend, payments, ledger, and the
decisions log.
