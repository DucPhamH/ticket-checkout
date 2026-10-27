# Overview

[Tiếng Việt](vi/01-overview.md)

A resale marketplace slice: a buyer picks a listing, pays through VNPay, and the money is
held in escrow until the event is marked completed.

## Services

| Service | Port             | Role                                                                                                          |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `web`   | 3000             | Next.js. Renders pages on the server, owns no business logic and no DB access.                                |
| `api`   | 4000             | Express. Orders, payments, ledger, admin actions. The only thing that talks to Postgres. API docs at `/docs`. |
| `db`    | 5432             | PostgreSQL 16.                                                                                                |
| `ngrok` | 4040 (inspector) | Optional (`--profile tunnel`). Gives the api a public URL so VNPay can deliver IPN.                           |

```
browser ──> web ──(server-side fetch)──> api ──> db
                                          ▲
VNPay ──(IPN)──> ngrok ───────────────────┘
VNPay ──(browser redirect)──> api /payments/vnpay/return ──> web /orders/:id
```

The browser only ever talks to `web`, with one exception: VNPay redirects the browser to the
api's return URL, which verifies the signature and redirects on to the web result page.
Because web calls the api from the server, there is no CORS setup and the current-user
cookie never leaves the web origin.

## Purchase flow

1. `GET /vi/events/1` – web renders the event and its listings (SSR).
2. Buyer picks a listing and quantity, submits. Web calls `POST /orders`.
3. Api reserves the tickets and creates a `PENDING` order in one transaction, then returns a
   signed VNPay payment URL. Web redirects the browser there.
4. Buyer pays with a sandbox card.
5. VNPay calls the IPN endpoint. This is the only thing that marks an order `PAID` and posts
   to the ledger.
6. VNPay redirects the browser back. The result page reads the order from the database; if it
   is still `PENDING` it asks VNPay directly (`querydr`) and refreshes until it settles.
7. Admin marks the event completed; escrow moves to the sellers' available balances.

## Where to look

```
apps/api         Express backend
apps/web         Next.js frontend
packages/shared  Fee math, status constants, DTO types used by both
docs/            You are here
```
