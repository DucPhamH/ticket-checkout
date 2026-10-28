# Payments (VNPay)

[Tiếng Việt](vi/05-payments.md)

> Status: signing and payment creation are built; the buyer is sent to the sandbox. The return URL
> and IPN come next.

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

| Check                                                         | Response                                    |
| ------------------------------------------------------------- | ------------------------------------------- |
| Signature invalid                                             | `97`                                        |
| Order not found                                               | `01`                                        |
| Amount differs from the order                                 | `04`                                        |
| Order already processed                                       | `02` (idempotent: no second ledger posting) |
| Success code: mark `PAID`, post ledger, in one DB transaction | `00`                                        |
| Failure code: mark `FAILED`, release tickets                  | `00`                                        |
| Anything unexpected                                           | `99`                                        |

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

## Signing (built)

`modules/payments/vnpay/` follows VNPay 2.1.0 as read on 2026-10-28:

- Parameters sorted by name; each value percent-encoded with spaces as `+` (what the PHP, Java and
  Node samples all produce); joined `k=v&k=v`; HMAC-SHA512 with `vnp_HashSecret`, hex.
- The same string is the URL query, followed by `&vnp_SecureHash=...`. `vnp_SecureHashType` is not
  sent (2.1.0) and is ignored when verifying, along with `vnp_SecureHash`.
- Amount ×100, dates `yyyyMMddHHmmss` in GMT+7, `vnp_OrderInfo` stripped of diacritics and symbols,
  `vnp_ExpireDate` = the order's reservation end.
- Verification compares signatures in constant time.
- A payment succeeds only when `vnp_ResponseCode` and `vnp_TransactionStatus` are both `00`.

Verified three ways: a unit test against an HMAC computed independently with `openssl`; a signed
URL (with spaces and `:`/`/` in its values) opens the sandbox's "Chọn phương thức thanh toán (Test)"
page; the same URL with the amount edited after signing is rejected with error code 70 (invalid
signature).

Credentials are checked when the server starts: if `VNP_TMN_CODE` / `VNP_HASH_SECRET` are missing
or malformed, the api logs every problem at `FATAL` level and exits, instead of failing the first
buyer. The check runs in `index.ts`, not in the shared env config, so the seed, migrations and tests
do not need real credentials (tests use fake ones).

We wrote the ~40 lines of signing rather than use the community `vnpay` npm package (~4k
downloads a week, one maintainer): fewer third-party dependencies in code that moves money, and
the logic stays readable.

## Creating the payment (built)

`POST /orders` creates the order and its `payments` row in the same transaction, then answers
`{ order, paymentUrl }`; web redirects the browser to `paymentUrl`.

- `vnp_TxnRef` is `<orderId>T<time base36><random>`: unique even after a database reset, when order
  ids start over but VNPay still remembers yesterday's references.
- `vnp_Amount` is the order total; `vnp_ExpireDate` is the order's `expires_at`, so the payment
  window and the ticket reservation end together.
- `vnp_Locale` follows the page language (`vi` → `vn`), and the return URL carries it
  (`/payments/vnpay/return/vi`) so the buyer comes back to the same language.
- `vnp_IpAddr` is the buyer's address forwarded by web in `X-Forwarded-For` (the api only sees
  web's address otherwise); IPv6 localhost is mapped to `127.0.0.1` to fit VNPay's 7–45 characters.
- When an order expires, its `PENDING` payment becomes `FAILED` in the same statement.
