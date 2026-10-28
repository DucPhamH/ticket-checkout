# Ticket checkout with escrow

[Tiếng Việt](README.vi.md)

A thin slice of an event-ticket resale marketplace. A buyer picks a listing and pays through the
**VNPay sandbox**; the money is held in **escrow** until an admin marks the event as having taken
place, and only then becomes available to the seller. Every money movement is a **double-entry
ledger** transaction, and every balance on screen is computed from the ledger.

TypeScript everywhere: Next.js 16 (server-rendered UI), Express 5 (api), PostgreSQL 16, Prisma 7,
npm workspaces, Docker Compose. The UI is in Vietnamese and English and works on phones.

## Run it

Requirements: Docker. Nothing else.

```bash
cp .env.example .env
# Fill in VNP_TMN_CODE and VNP_HASH_SECRET: VNPay sandbox credentials, sent separately.
# The api refuses to start without them (fail fast).
docker compose up --build
```

| What              | Where                               |
| ----------------- | ----------------------------------- |
| Web               | http://localhost:3000               |
| Api health        | http://localhost:4000/health        |
| Api docs, Swagger | http://localhost:4000/docs          |
| Postgres          | `localhost:5432`, user/pass/db `tc` |

`docker compose up` starts Postgres, runs a one-off `migrate` job (migrations + demo seed,
idempotent), then the api, then web. Ports taken? Set `WEB_PORT`, `API_PORT`, `DB_PORT` (and the
matching `WEB_PUBLIC_URL` / `API_PUBLIC_URL`) in `.env`.

### Try it

There is no login: pick who you are in the header's user switcher.

| User         | Role                                         |
| ------------ | -------------------------------------------- |
| Alice Nguyen | seller                                       |
| Bob Tran     | seller                                       |
| Chi Le       | buyer (the default)                          |
| Admin        | completes or cancels events, sees the ledger |

1. As **Chi**, open an event, pick a listing and a quantity, and pay. You are sent to the VNPay
   sandbox; pay with the test card from the sandbox registration (bank NCB).
2. Back on the order page, the order turns **Paid**. In **My wallet**, Chi sees the order; as
   **Alice** (the seller), the money shows as **pending (escrow)**.
3. As **Admin**, open **Admin** and click **Mark as taken place**: the escrow is released. Alice's
   money moves to **available**; the trial balance still sums to 0. An event can only be completed
   once it has started: the seeded **Đà Lạt Acoustic Night** is already under way (its tickets are
   still sold at the door), so buy one there first to see a payout.
4. Or **Cancel event** on an event that has not started: every paid order is refunded through
   VNPay's refund API.
5. Any user can sell: **Sell tickets** on an event page, **Withdraw** from My wallet.

### Payment results without a tunnel

VNPay reports the result twice: the browser comes back to the **return URL**, and VNPay calls
the **IPN** URL server to server. IPN is the source of truth, but VNPay cannot reach `localhost`.
So when the browser returns and no IPN has arrived, the api asks VNPay itself (**querydr**, a
signed server-to-server query) and applies the answer exactly as an IPN would. If VNPay is still
processing, the order page asks again, at most every 10 s, until there is an answer. **A reviewer does not need a tunnel.**

To receive real IPNs, the compose file has an ngrok service (needs `NGROK_AUTHTOKEN` and a fixed
`NGROK_DOMAIN`):

```bash
docker compose --profile tunnel up -d
# Register https://<NGROK_DOMAIN>/payments/vnpay/ipn in the VNPay sandbox merchant portal.
```

Details: [docs/running.md](docs/running.md#tunnel-for-vnpays-ipn).

## Fees and money

- The buyer pays **ticket price + 10%**; the seller receives **ticket price − 5%**; the platform
  keeps the 15%. Fees are computed once on the order subtotal, in basis points, rounded half up,
  and the platform's share is the remainder, so the parts always add up to what the buyer paid.
- Money is **integer VND** end to end (`BIGINT` in Postgres), never floats. VNPay's ×100 is
  applied only at the gateway boundary.
- Amounts are frozen on the order when it is created; the buyer is charged what they saw.

## Escrow and the ledger

| Event                     | Debit                       | Credit                                   |
| ------------------------- | --------------------------- | ---------------------------------------- |
| Payment captured (IPN)    | gateway clearing            | seller **pending**, platform fee pending |
| Event completed           | seller pending, fee pending | seller **available**, fee revenue        |
| Event cancelled           | seller pending, fee pending | buyer refund payable                     |
| Paid too late (no ticket) | gateway clearing            | buyer refund payable                     |
| Refund done (VNPay)       | buyer refund payable        | gateway clearing                         |

- Balances are never stored: pending, available and refund-pending are sums of ledger lines, on
  every request. The admin page shows the trial balance, which must be 0.
- The database enforces it too: a deferred trigger rejects any transaction whose lines do not sum
  to 0, the ledger tables are append-only, and every posting has an idempotency key
  (`capture:order:42`), so a retried IPN never posts twice.

More: [docs/06-ledger.md](docs/06-ledger.md).

## Correctness under concurrency

- **No overselling.** A reservation is one conditional `UPDATE … WHERE quantity_available >= n`.
- **Reservations expire** after 15 minutes (also sent to VNPay as the payment deadline). A sweep
  every 60 s uses `FOR UPDATE SKIP LOCKED` in batches; stale orders are also expired on read.
- **IPN, querydr and the expiry sweep** apply results in one place, locking the order then the
  payment, so a payment is applied once whatever arrives first. A payment that arrives after its
  tickets were sold to someone else, or after the event ended, is **refunded, never dropped**.
- **Completing or cancelling an event** locks the event row exclusively; buying and applying a
  payment take a shared lock, so no money can enter escrow after the event was settled.
- **Refunds** are sent with the refund row locked, so two clicks on retry refund once.

Each of these has a test that runs the two sides concurrently, and each was checked by removing
the lock and watching the test fail.

## Why VNPay

Native VND, the most widely used gateway in Vietnam, instant sandbox registration, and it has
everything this needs: browser redirect, server-to-server IPN, a query API for reconciliation and
a refund API. The integration is written by hand (signing is ~40 lines) rather than with a
community package, so every byte sent to the gateway is explained and tested.

## Decisions

The choices the brief left open, with reasons, are in [docs/decisions.md](docs/decisions.md).
The main ones:

- A separate Express api: money logic lives in one service; web calls it **from the server
  only** (no CORS, no api in the browser).
- No authentication, as allowed: the current user is a cookie, sent to the api as `X-User-Id`.
- The platform fee is held as _pending_ until the event takes place, because until then the sale
  can still be reversed.
- Database rules duplicated in SQL (CHECK constraints, ledger triggers) as the last line of defence.
- Extra scope beyond the brief: event cancellation with refunds, and seller-created listings.

Architecture docs for the codebase: [docs/](docs/README.md).

## Tests

```bash
npm install
npm run build -w @tc/shared
npm run dev:db        # Postgres in Docker
npm test              # 193 api tests
npm run lint && npm run typecheck
```

The api tests run against their own database (`tc_test`), rebuilt from the migrations on every
run, and never reach the network: VNPay's answers are mocked and signed with a test secret. They
cover the fee arithmetic, signing against values computed independently with `openssl`, every IPN
answer code, late and duplicate payments, the ledger invariants, pagination and the concurrency
cases above.

Development (hot reload, logs, simulating an IPN): [docs/running.md](docs/running.md).

## Not production-ready

What would need to change before real money:

- **Authentication.** Anyone can act as anyone, by design of the brief. Admin actions are gated
  only by the chosen user's role.
- **Reservation abuse.** No limit on unpaid orders per person and no rate limiting: someone could
  hold every ticket for 15 minutes at a time.
- **No background reconciliation.** If IPN never arrives _and_ the buyer closes the tab before
  returning, a paid order expires. No money is lost (a late IPN or
  `npm run vnpay:reconcile -w @tc/api -- <orderId>` re-takes the tickets or refunds), but nothing
  finds it automatically. Production needs a periodic querydr job for unresolved payments.
- **Large events.** Completing or cancelling an event settles all its orders in one transaction,
  and cancellation sends refunds one by one within the request. A big event needs batches and a
  job queue.
- **Refunds against the live sandbox are not yet verified.** The refund call is built to VNPay's
  spec and tested with signed mock answers; while it was being finished, the sandbox's
  server-to-server API (querydr and refund) answered `99 Unexpected error` to every request,
  including queries that had worked earlier the same day. If a refund fails, it stays listed for
  the admin to retry.
- **Operations.** Secrets come from `.env` (a secret manager in production), logs are JSON on
  stdout without a collector, there is no monitoring or alerting, and the IPN tunnel is ngrok's
  free plan.

## How AI was used

Built with an AI coding assistant (Claude Code) as a pair programmer. I set the scope and the
plan, one feature per commit, and reviewed and ran each step; the assistant wrote most of the code,
tests and documentation and explained each concept as we went. Its output was checked by the test
suite, by deliberately breaking each safeguard to confirm a test fails, and by end-to-end payments
against the real VNPay sandbox (including a real IPN delivered through the tunnel). VNPay's spec
was read from its official documentation, and where it was wrong (a missing `|` in the querydr
response checksum) the fix was confirmed against the live sandbox.

## Time spent

About _N_ hours over _N_ days.
