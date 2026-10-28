# Decisions

[Tiếng Việt](vi/decisions.md)

Choices the brief left open. Newest at the bottom.

**VNPay as the gateway.** See [Payments](05-payments.md#why-vnpay).

**Separate Express api instead of Next.js route handlers.** Keeps money logic out of the UI
process, matches "a Node.js backend" literally, and lets the api be tested without a browser.
Cost: one more service and an internal HTTP hop.

**Web calls the api only from the server.** No CORS, no api URL in the browser, the user cookie
stays on one origin.

**No authentication; current user in a cookie.** Allowed by the brief. Web forwards it as
`X-User-Id`. Anyone can impersonate anyone, which is fine for a demo and listed as not
production-ready.

**Money as integer VND.** No floats anywhere. Fees are computed on the order subtotal in basis
points, rounded half up; the platform's share is the remainder.

**Fees on the subtotal, not per ticket.** Fewer rounding steps and one source of truth.

**Tickets are reserved for 15 minutes** when an order is created, matching VNPay's
`vnp_ExpireDate`. Expired orders release their tickets.

**Platform fee recognised on completion.** Held in `fee_pending` until the event happens so a
cancellation can refund the buyer in full.

**Late payments are refunded, not dropped.** See [Payments](05-payments.md#ipn-handling).

**ngrok with a fixed domain over a Cloudflare quick tunnel.** VNPay's IPN URL is configured per
merchant, so it must not change between runs. ngrok's free plan includes one fixed domain;
Cloudflare needs a purchased domain for that.

**Extra scope: cancel event + refunds, seller-created listings.** Not required; added because
they exercise the ledger in both directions.

**Feature-based folders with an enforced import rule.** See [Frontend](04-frontend.md#the-import-rule).

**ESLint 9, not 10.** `eslint-plugin-import` does not support ESLint 10 yet.

**Next.js agent files disabled** (`agentRules: false`). Next 16 writes `AGENTS.md` on `next dev`;
we don't keep generated tool files in the repo.

**Prisma 7 (stable), not 8.** npm currently tags an 8.0 release candidate as `latest`; 7.10 is
the newest stable release.

**Database rules duplicated in SQL.** CHECK constraints and ledger triggers back up the
application logic, so a bug cannot write an inconsistent order or an unbalanced ledger.

**`payments` separate from `orders`.** See [Database](07-database.md#tables).

**Integer ids.** Simple and readable in a demo. Sequential order ids in URLs would be a problem
with real users (enumeration); with authentication and ownership checks it matters less, and
a public random reference could be added.

**OpenAPI generated from zod schemas.** One source of truth for validation and documentation,
instead of hand-written YAML or JSDoc comments that drift.

**The public event list shows active events only**, soonest first. Completed or cancelled events
can no longer be bought; their pages stay reachable by id, and admin gets its own list.
`minPrice` and `ticketsAvailable` count only listings that are active and not sold out, computed
with one `GROUP BY` query rather than loading every listing.

**Input validated in controllers with zod.** `Schema.parse(req.params)` returns typed values and
reuses the schema in the OpenAPI doc; the error handler turns `ZodError` into
`400 VALIDATION_ERROR` with the failing field (`id: ...`).

**An inactive event returns no listings.** Its page still loads (by id), but a completed or
cancelled event cannot be bought, so listing its tickets would mislead.

**Overselling is prevented by one conditional UPDATE**
(`quantity_available = quantity_available - n WHERE quantity_available >= n`) inside the order
transaction; Postgres locks the row, so concurrent buyers are serialised. Tests fire 2 and 10
simultaneous requests at the last tickets, and fail if the reservation is rewritten as
read-then-write.

**Admins cannot buy** (403 `ADMIN_CANNOT_BUY`): the admin is an operator account. **Sellers cannot
buy their own listing** (409 `OWN_LISTING`). **At most 10 tickets per order**, shared by the UI
stepper and the api.

**Someone else's order is a 404, not a 403**, so order ids cannot be probed.

**API test files run one at a time** against the shared dev database, each creating and removing
its own tagged fixtures.

**Unpaid orders expire in-process, not with a separate worker or cron.** A 60-second sweep inside
the api plus expiry on read and before reserving keeps tickets available without extra
infrastructure. It is idempotent, so running several api instances is safe; at larger scale it
would move to a dedicated worker or a database-scheduled job.

**Fail fast on missing payment credentials.** The api refuses to start without valid VNPay
credentials, so a misconfiguration shows up at deploy time rather than at the first payment. The
check lives in the server entry point, so the seed, migrations and tests run without them.

**Tests run against their own database, rebuilt every run.** Once tests post real ledger entries
(append-only) through the api, cleaning up after them is impossible, so the suite recreates
`tc_test` (migrations + seed) before it starts. The dev database is never touched.

**querydr as the safety net for IPN.** Payment results are applied in one place
(`settleGatewayResult`) whether they come from IPN or from our own query, so the two paths cannot
diverge or double-apply. Queries are triggered by the buyer coming back or waiting on the order page,
throttled to one per 10 seconds per payment.

**No real network in tests.** A setup file makes every `fetch` fail unless a test mocks the gateway's
answer, so the suite never depends on, or sends credentials to, an outside service.
