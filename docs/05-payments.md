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
