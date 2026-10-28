# Ledger

[Tiếng Việt](vi/06-ledger.md)

> Status: tables, constraints, triggers, the posting service, balance queries, event settlement,
> cancellation and refunds are built and tested.

Every money movement is a double-entry transaction. Balances are never stored; they are sums
over ledger lines.

## Tables

- `accounts` – one row per account code.
- `ledger_transactions` – one row per business event, with a unique `idempotency_key`
  (e.g. `capture:order:42`) so retries cannot post twice.
- `ledger_entries` – lines. `amount` is a signed BIGINT in VND: positive = debit,
  negative = credit.

A deferred constraint trigger checks that each transaction's lines sum to zero at commit, so a
bug in application code cannot write an unbalanced transaction. Another trigger makes both
ledger tables append-only. The `account_balances` view gives every balance in one query.

## Accounts

| Code                        | Type      | Meaning                                          |
| --------------------------- | --------- | ------------------------------------------------ |
| `platform:gateway_clearing` | asset     | money VNPay collected for us                     |
| `seller:{id}:pending`       | liability | seller money held in escrow                      |
| `seller:{id}:available`     | liability | released to the seller                           |
| `buyer:{id}:refund_payable` | liability | owed back to a buyer                             |
| `platform:fee_pending`      | liability | our fee, not yet earned (event may be cancelled) |
| `platform:fee_revenue`      | revenue   | our fee, earned                                  |

Balance of an asset = sum of amounts; of a liability or revenue account = minus the sum.

## Postings

Example order: 2 tickets × 500,000 = subtotal 1,000,000; buyer pays 1,100,000; seller gets
950,000; we keep 150,000.

| Event                                         | Debit                                       | Credit                                        |
| --------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| `PAYMENT_CAPTURED` (IPN success)              | gateway_clearing 1,100,000                  | seller pending 950,000; fee_pending 150,000   |
| `EVENT_SETTLED` (event completed)             | seller pending 950,000; fee_pending 150,000 | seller available 950,000; fee_revenue 150,000 |
| `ORDER_CANCELLED` (event cancelled)           | seller pending 950,000; fee_pending 150,000 | buyer refund_payable 1,100,000                |
| `LATE_PAYMENT` (paid after the order expired) | gateway_clearing 1,100,000                  | buyer refund_payable 1,100,000                |
| `REFUND_COMPLETED` (VNPay refund OK)          | buyer refund_payable 1,100,000              | gateway_clearing 1,100,000                    |

Why the fee sits in `fee_pending` first: until the event happens the sale can still be
reversed, so it is not revenue yet.

## Invariants

- Each transaction sums to zero (DB trigger).
- The whole ledger sums to zero (shown on the admin page as a trial balance).
- `total = sellerPayout + platformRevenue` for every order; the platform share is computed as the
  remainder so rounding never loses a đồng (tested in `test/shared/fees.test.ts`).
- Amounts are integers end to end. VND has no minor unit; VNPay's ×100 is applied only when
  building the payment URL.

## Posting service (built)

`modules/ledger/ledger.service.ts`. Callers describe a movement with `debit`/`credit` lines on
accounts from `constants/ledger.ts`:

```ts
await postTransaction(tx, {
  kind: 'PAYMENT_CAPTURED',
  idempotencyKey: `capture:order:${order.id}`,
  orderId: order.id,
  lines: [
    debit(ACCOUNTS.gatewayClearing, total),
    credit(ACCOUNTS.sellerPending(sellerId), sellerPayout),
    credit(ACCOUNTS.feePending, platformRevenue),
  ],
});
```

- Runs inside the caller's transaction, so the money movement commits with the business change.
- Checks ≥ 2 lines, no zero line and a zero sum before writing; the database checks again.
- Creates a per-user account (e.g. `seller:2:pending`) the first time it is used.
- Idempotent: the header is inserted with `ON CONFLICT (idempotency_key) DO NOTHING`. A repeat
  writes nothing and returns the first transaction with `created: false`; a concurrent poster of the
  same key waits for the first one, then does nothing.

Tests run inside rolled-back transactions because ledger rows cannot be deleted.

## Reading balances (built)

`modules/ledger/ledger.balances.ts` sums the entries on every call; nothing is cached.

- `getUserBalances(userId)` → pending, available, refund pending (`GET /me/balances`). Accounts the
  user has never used count as 0.
- `getTrialBalance()` → every account as stored (+ debit, − credit) and the total, which must be 0
  (`GET /admin/trial-balance`).
- `ledger.history.ts`: the lines on a user's accounts, newest first, paginated by entry id
  (`GET /me/ledger`).

## Settling an event (built)

`POST /admin/events/:id/complete` (`modules/events/event-completion.ts`), in one transaction:

1. Lock the event row `FOR UPDATE`, set it to `COMPLETED`.
2. For every `PAID` order of the event, post `EVENT_SETTLED` with key `settle:order:<id>`.
   Repeating the request posts nothing new.

The race it must survive: a payment succeeding at the same moment. If it landed in
`seller:pending` after step 2 had read the orders, it would never be released. So creating an
order and applying a successful payment both take a `FOR SHARE` lock on the event row
(`events/event-lock.ts`):

- the payment locked first → its order is `PAID` before step 2 reads the orders, and is settled;
- the completion locked first → the payment sees the event is no longer `ACTIVE` and owes the money
  back (`LATE_PAYMENT` posting, refund reason `EVENT_ENDED`) instead of entering escrow.

Lock order is always order → payment → event for payments, and the completion locks only the
event, so they cannot deadlock. `test/modules/event-completion.test.ts` races the two ten times;
without the shared lock it leaves money stuck in escrow.

## Cancelling an event and refunding (built)

`POST /admin/events/:id/cancel` (`modules/events/event-cancellation.ts`):

1. One transaction, event locked `FOR UPDATE` as above: the event becomes `CANCELLED`; every `PAID`
   order becomes `REFUND_PENDING`, gets a `refunds` row (reason `EVENT_CANCELLED`) and an
   `ORDER_CANCELLED` posting (key `cancel:order:<id>`) that moves its money out of escrow into the
   buyer's `refund_payable`.
2. After the commit, each refund is sent to VNPay (`payments/payments.refund.ts`). Success posts
   `REFUND_COMPLETED` (key `refund:<id>`) and the order becomes `REFUNDED`. A refusal or an
   unreachable gateway leaves the refund `FAILED` with `last_error`; the admin retries it from the
   refunds list (`POST /admin/refunds/:id/retry`). The cancellation itself is never undone.

The refund row is locked `FOR UPDATE` while VNPay answers, so two retries clicked at once send it
once (tested). Refunds from late payments (`LATE_PAYMENT`, `EVENT_ENDED`) go through the same path.
A completed event cannot be cancelled: its escrow already went to the sellers.
