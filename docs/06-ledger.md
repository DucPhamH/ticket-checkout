# Ledger

> Status: designed, not yet implemented (plan steps 2–3).

Every money movement is a double-entry transaction. Balances are never stored; they are sums
over ledger lines.

## Tables

- `accounts` – one row per account code.
- `ledger_transactions` – one row per business event, with a unique `idempotency_key`
  (e.g. `capture:order:42`) so retries cannot post twice.
- `ledger_entries` – lines. `amount` is a signed BIGINT in VND: positive = debit,
  negative = credit.

A deferred constraint trigger checks that each transaction's lines sum to zero at commit, so a
bug in application code cannot write an unbalanced transaction. Lines are insert-only.

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
