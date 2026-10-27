# Payments (VNPay)

> Status: designed, not yet implemented (plan step 6).

## Why VNPay

Native VND, the most widely used gateway in Vietnam, instant sandbox registration, and it has
everything the brief needs: browser redirect, server-to-server IPN, a query API for
reconciliation, and a refund API.

## Flow

1. `POST /orders` creates a `PENDING` order and builds a payment URL:
   `vnp_Amount` (VND × 100), `vnp_TxnRef` (our order id), `vnp_ExpireDate` (15 min, same as the
   ticket reservation), `vnp_ReturnUrl`, signed with HMAC-SHA512 over the sorted query string.
2. Browser goes to VNPay, pays with a sandbox card.
3. **IPN** (`GET /payments/vnpay/ipn`, server to server) – the source of truth.
4. **Return** (`GET /payments/vnpay/return`, browser) – display only.

## IPN handling

Every call is stored in `payment_notifications` before anything else, then:

| Check | Response |
|---|---|
| Signature invalid | `97` |
| Order not found | `01` |
| Amount differs from the order | `04` |
| Order already processed | `02` (idempotent: no second ledger posting) |
| Success code: mark `PAID`, post ledger, in one DB transaction | `00` |
| Failure code: mark `FAILED`, release tickets | `00` |
| Anything unexpected | `99` |

VNPay stops retrying after `00` or `02`; otherwise it retries up to 10 times, 5 minutes apart.

Edge case: payment succeeds after the reservation expired and the tickets were sold to someone
else. The money is real, so it is recorded (`LATE_PAYMENT`) and owed back to the buyer as a
refund rather than ignored.

## Return URL and reconciliation

The return URL is never trusted to change state: a user can close the tab or edit the query
string. The api verifies the signature, and if the order is still `PENDING` (IPN late or not
delivered) it calls VNPay `querydr` and applies the result through the same code path as IPN.
Then it redirects to the web result page, which reads the order from the database.

This matters locally: the IPN URL is configured per merchant on VNPay's side, so if a reviewer
runs the project with our sandbox credentials, IPN goes to our tunnel, not theirs. `querydr`
keeps their result page correct anyway.

## Receiving IPN locally

VNPay must reach the api over HTTPS. `docker compose --profile tunnel up` starts ngrok with a
fixed free domain (`NGROK_DOMAIN`), so the IPN URL registered with VNPay never changes. The
ngrok inspector at `http://localhost:4040` shows every IPN request.
