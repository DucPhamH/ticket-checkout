# Luồng thanh toán từ đầu đến cuối (kèm dữ liệu thật)

[Thanh toán (tóm tắt kỹ thuật)](05-payments.md) · [Đọc database từng bảng](08-database-guide.md)

Tài liệu này đi theo **một lần mua thật**: Chi Le (người dùng 3) mua **1 vé Saigon Jazz Festival** của
Alice (tin đăng 5, giá 650.000đ) ngày 2026-10-28, thanh toán bằng thẻ test NCB. Đơn **#641**.

Mỗi bước ghi rõ: **ai làm**, **file nào**, **đọc gì từ database**, **ghi gì vào database**, **gửi gì
cho VNPay**. Mọi con số là số thật lấy từ database sau lần mua đó. Giờ ghi theo giờ Việt Nam (GMT+7).

## Mục lục

1. [Toàn cảnh](#1-toàn-cảnh)
2. [Bước 1 – Chi bấm "Thanh toán"](#2-bước-1--chi-bấm-thanh-toán)
3. [Bước 2 – Web gọi api tạo đơn](#3-bước-2--web-gọi-api-tạo-đơn)
4. [Bước 3 – Api giữ vé, tạo đơn và payment](#4-bước-3--api-giữ-vé-tạo-đơn-và-payment)
5. [Bước 4 – Api dựng URL VNPay có chữ ký](#5-bước-4--api-dựng-url-vnpay-có-chữ-ký)
6. [Bước 5 – Chi trả tiền trên VNPay](#6-bước-5--chi-trả-tiền-trên-vnpay)
7. [Bước 6 – VNPay gọi IPN (cập nhật kết quả)](#7-bước-6--vnpay-gọi-ipn-cập-nhật-kết-quả)
8. [Bước 7 – Trình duyệt quay về (Return URL)](#8-bước-7--trình-duyệt-quay-về-return-url)
9. [Bước 8 – Trang đơn hiển thị kết quả](#9-bước-8--trang-đơn-hiển-thị-kết-quả)
10. [Tổng hợp: database thay đổi thế nào](#10-tổng-hợp-database-thay-đổi-thế-nào)
11. [Các nhánh khác](#11-các-nhánh-khác)
12. [Bản đồ file](#12-bản-đồ-file)

---

## 1. Toàn cảnh

```
TRÌNH DUYỆT          WEB (:3000)            API (:4000)                    DATABASE              VNPAY
    │ B1 bấm Thanh toán  │                      │                               │                    │
    ├───────────────────►│ B2 POST /orders ────►│ B3 giữ vé, tạo đơn + payment ─►│ listings, orders,  │
    │                    │                      │ B4 ký URL                     │ payments           │
    │                    │◄─ {order,paymentUrl}─┤                               │                    │
    │◄── chuyển hướng ───┤                      │                               │                    │
    ├────────────────────────────────── B5 mở URL, nhập thẻ, OTP ─────────────────────────────────────►│
    │                    │                      │◄──── B6 IPN (server gọi server, qua ngrok) ─────────┤
    │                    │                      │ đơn PAID, ghi sổ cái ─────────►│ payments, orders,  │
    │                    │                      │                               │ ledger_*, notif.   │
    │◄──────────────────────────────── B7 VNPay chuyển trình duyệt về Return URL ─────────────────────┤
    ├──────────────────────────────────────────►│ ghi lại thông báo ────────────►│ payment_notif.     │
    │◄────────────── 302 về trang đơn ──────────┤                               │                    │
    ├───────────────────►│ B8 GET /orders/641 ─►│ đọc đơn ──────────────────────►│                    │
    │◄─ "Thành công" ────┤                      │                               │                    │
```

Bảng nào bị ghi ở bước nào:

| Bảng                    | B3 tạo đơn         | B6 IPN                             | B7 Return         |
| ----------------------- | ------------------ | ---------------------------------- | ----------------- |
| `listings`              | trừ vé (2 → 1)     |                                    |                   |
| `orders`                | **thêm** (PENDING) | sửa → PAID                         |                   |
| `payments`              | **thêm** (PENDING) | sửa → SUCCEEDED + mã VNPay         |                   |
| `payment_notifications` |                    | **thêm** (IPN)                     | **thêm** (RETURN) |
| `accounts`              |                    | tạo `seller:1:pending` nếu chưa có |                   |
| `ledger_transactions`   |                    | **thêm** 1 dòng                    |                   |
| `ledger_entries`        |                    | **thêm** 3 dòng                    |                   |

---

## 2. Bước 1 – Chi bấm "Thanh toán"

**Ai:** trình duyệt. **File:** `apps/web/features/checkout/components/ticket-picker.tsx`

Trên trang sự kiện, Chi chọn tin của Alice. Giao diện tự tính và hiện giá bằng hàm dùng chung
`calculateOrderAmounts(650000, 1)` (trong `packages/shared`): tạm tính 650.000, phí 65.000, tổng
715.000. Đây **chỉ để hiển thị**; api sẽ tự tính lại, không tin con số từ trình duyệt.

Bấm "Thanh toán với VNPay" gửi form với đúng hai giá trị:

```
listingId = 5
quantity  = 1
```

## 3. Bước 2 – Web gọi api tạo đơn

**Ai:** web server (Next). **File:** `apps/web/features/checkout/actions.ts`, hàm `createOrder`

Server Action thêm ngôn ngữ (lấy từ URL `/vi/...`) và IP của Chi, rồi gọi api qua
`apps/web/lib/api-client.ts`:

```http
POST http://localhost:4000/orders
X-User-Id: 3                    ← người dùng hiện tại, từ cookie tc_uid
X-Forwarded-For: 127.0.0.1      ← IP người mua (chạy local nên là localhost)
Content-Type: application/json

{ "listingId": 5, "quantity": 1, "locale": "vi" }
```

Trình duyệt không gọi api trực tiếp; chỉ web server gọi.

## 4. Bước 3 – Api giữ vé, tạo đơn và payment

**Ai:** api. Request đi qua:

```
orders.router.ts            POST /orders
→ middlewares/current-user  đọc header X-User-Id = 3 → SELECT users WHERE id = 3 → Chi Le
→ orders.controller.ts      kiểm tra body bằng zod (quantity 1–10, locale vi|en)
→ orders.service.ts         createOrder(Chi, { listingId: 5, quantity: 1, locale: 'vi' })
```

`createOrder` chạy **trong một transaction**: hoặc mọi bước dưới đây cùng được lưu, hoặc không bước
nào được lưu.

| #   | Làm gì                      | Đọc / ghi                                                                                                           | Dữ liệu thật                                                               |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| a   | Đọc tin đăng                | ĐỌC `listings` + `events`                                                                                           | tin 5: Alice bán, 650.000đ, sự kiện đang mở bán                            |
| b   | Kiểm tra luật               | –                                                                                                                   | Chi không phải admin, không phải người bán                                 |
| c   | Dọn đơn quá hạn của tin này | GHI `orders`, `payments`, `listings` (nếu có)                                                                       | không có                                                                   |
| d   | **Giữ vé**                  | GHI `listings`: `UPDATE … SET quantity_available = quantity_available - 1 WHERE id = 5 AND quantity_available >= 1` | **2 → 1**                                                                  |
| e   | Tính tiền                   | `calculateOrderAmounts(650000, 1)`                                                                                  | tạm tính 650.000, phí người mua 65.000, phí người bán 32.500, tổng 715.000 |
| f   | **Tạo đơn**                 | THÊM vào `orders`                                                                                                   | xem bên dưới                                                               |
| g   | **Tạo payment**             | THÊM vào `payments`                                                                                                 | xem bên dưới                                                               |

Dòng `orders` vừa tạo (giờ GMT+7):

| Cột          | Giá trị      | Ghi chú                                 |
| ------------ | ------------ | --------------------------------------- |
| `id`         | 641          |                                         |
| `buyer_id`   | 3            | Chi                                     |
| `listing_id` | 5            |                                         |
| `quantity`   | 1            |                                         |
| `unit_price` | 650000       | **chép** từ tin đăng, sau này không đổi |
| `subtotal`   | 650000       |                                         |
| `buyer_fee`  | 65000        | 10%                                     |
| `seller_fee` | 32500        | 5%, dùng khi ghi sổ                     |
| `total`      | 715000       | Chi phải trả                            |
| `status`     | `PENDING`    |                                         |
| `created_at` | 13:40:20.866 |                                         |
| `expires_at` | 13:55:20.866 | **+15 phút**: hết giữ vé                |
| `paid_at`    | (trống)      |                                         |

Dòng `payments` vừa tạo:

| Cột                               | Giá trị              | Ghi chú                                                         |
| --------------------------------- | -------------------- | --------------------------------------------------------------- |
| `id`                              | 135                  |                                                                 |
| `order_id`                        | 641                  |                                                                 |
| `provider`                        | `VNPAY`              |                                                                 |
| `txn_ref`                         | `641Tmvrqw6me79a3a9` | mã mình gửi VNPay: `641` + `T` + thời gian (hệ 36) + ngẫu nhiên |
| `amount`                          | 715000               | = `orders.total`                                                |
| `status`                          | `PENDING`            |                                                                 |
| các cột `provider_*`, `bank_code` | (trống)              | VNPay chưa trả lời                                              |

## 5. Bước 4 – Api dựng URL VNPay có chữ ký

**File:** `payments.service.ts` → `vnpay/vnpay.payment-url.ts` → `vnpay/vnpay.signature.ts`

Gom tham số, đổi từ dữ liệu của mình sang định dạng VNPay:

| Tham số                                                       | Giá trị                                          | Lấy từ                                         |
| ------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `vnp_Amount`                                                  | `71500000`                                       | `orders.total` × 100 (luật VNPay)              |
| `vnp_TxnRef`                                                  | `641Tmvrqw6me79a3a9`                             | `payments.txn_ref`                             |
| `vnp_CreateDate`                                              | `20261028134020`                                 | `orders.created_at` đổi sang GMT+7             |
| `vnp_ExpireDate`                                              | `20261028135520`                                 | `orders.expires_at` (hết giữ vé = hết hạn trả) |
| `vnp_OrderInfo`                                               | `Thanh toan don hang 641`                        | không dấu (luật VNPay)                         |
| `vnp_Locale`                                                  | `vn`                                             | `vi` của web → `vn`                            |
| `vnp_ReturnUrl`                                               | `http://localhost:4000/payments/vnpay/return/vi` | `API_PUBLIC_URL` + ngôn ngữ                    |
| `vnp_IpAddr`                                                  | `127.0.0.1`                                      | header `X-Forwarded-For`                       |
| `vnp_TmnCode`                                                 | (mã website)                                     | `.env`                                         |
| `vnp_Version`, `vnp_Command`, `vnp_CurrCode`, `vnp_OrderType` | `2.1.0`, `pay`, `VND`, `other`                   | hằng số                                        |

Ký:

```
1. Sắp xếp tên tham số A→Z, mã hoá giá trị (dấu cách → +), nối bằng &:
   vnp_Amount=71500000&vnp_Command=pay&vnp_CreateDate=20261028134020&...
   &vnp_OrderInfo=Thanh+toan+don+hang+641&...&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A4000%2F...&...
2. vnp_SecureHash = HMAC-SHA512(chuỗi trên, VNP_HASH_SECRET)   → 128 ký tự hex
3. URL = https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?<chuỗi trên>&vnp_SecureHash=<chữ ký>
```

Api trả cho web:

```json
201 { "order": { "id": 641, "status": "PENDING", "total": 715000, ... },
      "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=71500000&..." }
```

Web chuyển trình duyệt của Chi sang `paymentUrl` (`redirect(result.paymentUrl)` trong `actions.ts`).

## 6. Bước 5 – Chi trả tiền trên VNPay

Database của mình **không thay đổi gì** ở bước này.

- VNPay tự tính lại chữ ký bằng cùng `HashSecret`. Khớp thì hiện "Chọn phương thức thanh toán". Ai sửa
  `vnp_Amount` trên URL thì chữ ký không khớp và VNPay báo lỗi (mã 70).
- Chi chọn Thẻ nội địa → NCB → nhập thẻ test → OTP `123456`.
- VNPay ghi nhận giao dịch lúc **13:41:14** (`vnp_PayDate`), mã giao dịch phía VNPay **15717208**.

Sau đó VNPay làm **hai việc gần như cùng lúc**: gọi IPN (bước 6) và chuyển trình duyệt về (bước 7).

## 7. Bước 6 – VNPay gọi IPN (cập nhật kết quả)

**Ai:** server của VNPay (User-Agent `VNPAY GATEWAY/2.0`), gọi qua ngrok:

```http
GET https://callan-monied-expensively.ngrok-free.dev/payments/vnpay/ipn
    ?vnp_Amount=71500000&vnp_BankCode=NCB&vnp_BankTranNo=VNP15717208&vnp_CardType=ATM
    &vnp_OrderInfo=Thanh+toan+don+hang+641&vnp_PayDate=20261028134114
    &vnp_ResponseCode=00&vnp_TmnCode=...&vnp_TransactionNo=15717208
    &vnp_TransactionStatus=00&vnp_TxnRef=641Tmvrqw6me79a3a9&vnp_SecureHash=...
```

ngrok chuyển request về `localhost:4000`. **File:** `payments.router.ts` → `payments.ipn.ts` →
`payments.settlement.ts`

**Kiểm tra lần lượt** (sai ở đâu thì dừng và trả mã đó cho VNPay):

| Kiểm tra                                                                | Kết quả đơn 641            |
| ----------------------------------------------------------------------- | -------------------------- |
| Đủ tham số (`vnp_TxnRef`, `vnp_SecureHash`, `vnp_Amount`)? Không → `99` | ✅ đủ                      |
| Chữ ký VNPay đúng? Không → `97`                                         | ✅ đúng                    |
| ĐỌC `payments` WHERE `txn_ref = '641Tmvrqw6me79a3a9'`. Không có → `01`  | ✅ payment 135             |
| (bắt đầu transaction, **khoá** dòng đơn 641 rồi dòng payment 135)       |                            |
| `vnp_Amount` = `payments.amount` × 100? Không → `04`                    | ✅ 71500000 = 715000 × 100 |
| `payments.provider_response_code` đã có giá trị (đã xử lý)? Có → `02`   | ✅ còn trống               |
| `vnp_ResponseCode = 00` **và** `vnp_TransactionStatus = 00`?            | ✅ → **thành công**        |

**Ghi vào database** (cùng một transaction):

1. SỬA `payments` (id 135):

   | Cột                       | Trước   | Sau              |
   | ------------------------- | ------- | ---------------- |
   | `status`                  | PENDING | **SUCCEEDED**    |
   | `provider_response_code`  | (trống) | `00`             |
   | `provider_transaction_no` | (trống) | `15717208`       |
   | `provider_pay_date`       | (trống) | `20261028134114` |
   | `bank_code`               | (trống) | `NCB`            |

2. SỬA `orders` (id 641): `status` PENDING → **PAID**, `paid_at` = 13:41:19.985.

3. Ghi sổ cái (`ledger.postings.ts` → `ledger.service.ts`):
   - THÊM `ledger_transactions`: id 308, `kind = PAYMENT_CAPTURED`,
     `idempotency_key = capture:order:641` (chống ghi trùng), `order_id = 641`.
   - Tạo tài khoản `seller:1:pending` trong `accounts` nếu Alice chưa có.
   - THÊM 3 dòng `ledger_entries`:

     | entry | Tài khoản                   | amount       | Đọc là                                          |
     | ----- | --------------------------- | ------------ | ----------------------------------------------- |
     | 412   | `platform:gateway_clearing` | **+715.000** | VNPay đang giữ hộ sàn 715.000                   |
     | 413   | `seller:1:pending`          | **−617.500** | Nợ Alice 650.000 − 32.500, chờ sự kiện diễn ra  |
     | 414   | `platform:fee_pending`      | **−97.500**  | Phí sàn 65.000 + 32.500, chưa tính là doanh thu |
     |       | **Tổng**                    | **0**        | trigger của database kiểm tra lại lúc COMMIT    |

4. COMMIT.

5. THÊM `payment_notifications` (id 42, **ngoài** transaction để luôn được lưu, kể cả khi xử lý lỗi):
   `source = IPN`, `signature_valid = true`, `result = 00`, `payload` = toàn bộ tham số nguyên văn,
   lúc 13:41:19.999.

**Trả lời VNPay:** HTTP 200 `{"RspCode":"00","Message":"Confirm Success"}`. VNPay nhận `00` nên
không gọi lại nữa.

## 8. Bước 7 – Trình duyệt quay về (Return URL)

**Ai:** trình duyệt của Chi, **0,28 giây sau** IPN. **File:** `payments.return.ts`

```http
GET http://localhost:4000/payments/vnpay/return/vi?vnp_Amount=71500000&...&vnp_SecureHash=...
```

(cùng bộ tham số với IPN, nhưng lần này do **trình duyệt** mang tới, nên không được tin để đổi trạng
thái)

| Làm gì                           | Kết quả đơn 641                                           |
| -------------------------------- | --------------------------------------------------------- |
| Kiểm tra chữ ký                  | ✅ đúng                                                   |
| ĐỌC `payments` theo `vnp_TxnRef` | payment 135, `provider_response_code = 00` (IPN đã xử lý) |
| Kết luận                         | `REPORTED_SUCCESS`                                        |
| THÊM `payment_notifications`     | id 43, `source = RETURN`, lúc 13:41:20.276                |
| Có cần hỏi VNPay (`querydr`)?    | **Không**: payment đã có kết quả từ IPN                   |
| Đổi `orders` / `payments`?       | **Không bao giờ** ở bước này                              |
| Trả lời                          | `302` → `http://localhost:3000/vi/orders/641`             |

## 9. Bước 8 – Trang đơn hiển thị kết quả

**Ai:** web server. **File:** `apps/web/app/[locale]/orders/[id]/page.tsx`

```http
GET http://localhost:4000/orders/641     (X-User-Id: 3)
```

Api (`orders.controller.ts`): kiểm tra hết hạn (chưa), ĐỌC `orders` + `listings` + `events` + `users`
(người bán), chỉ trả nếu `buyer_id = 3`. Đơn đã `PAID` nên không cần hỏi VNPay.

```json
{ "id": 641, "status": "PAID", "total": 715000, "paidAt": "2026-10-28T06:41:19.985Z", ... }
```

Trang hiện **"Thanh toán thành công"**. Nếu lúc này đơn còn `PENDING`, trang sẽ tự làm mới mỗi 3 giây
(`order-auto-refresh.tsx`) cho tới khi có kết quả.

---

## 10. Tổng hợp: database thay đổi thế nào

Theo đúng thứ tự thời gian của đơn 641:

| Giờ (GMT+7)  | Bảng                    | Thao tác | Nội dung                                          |
| ------------ | ----------------------- | -------- | ------------------------------------------------- |
| 13:40:20.866 | `listings` (5)          | SỬA      | `quantity_available` 2 → 1                        |
| 13:40:20.866 | `orders`                | THÊM     | 641, PENDING, total 715.000, hết hạn 13:55:20     |
| 13:40:20.870 | `payments`              | THÊM     | 135, PENDING, `txn_ref` 641Tmvrqw6me79a3a9        |
| 13:41:19.985 | `payments` (135)        | SỬA      | SUCCEEDED, mã VNPay 15717208, NCB, 20261028134114 |
| 13:41:19.985 | `orders` (641)          | SỬA      | PAID, `paid_at`                                   |
| 13:41:19.985 | `ledger_transactions`   | THÊM     | 308, PAYMENT_CAPTURED, `capture:order:641`        |
| 13:41:19.985 | `ledger_entries`        | THÊM ×3  | +715.000 / −617.500 / −97.500                     |
| 13:41:19.999 | `payment_notifications` | THÊM     | 42, IPN, chữ ký đúng, `00`                        |
| 13:41:20.276 | `payment_notifications` | THÊM     | 43, RETURN, chữ ký đúng, REPORTED_SUCCESS         |

Tự xem lại bằng SQL:

```sql
SELECT * FROM orders WHERE id = 641;
SELECT * FROM payments WHERE order_id = 641;
SELECT source, result, received_at FROM payment_notifications
  WHERE payment_id = (SELECT id FROM payments WHERE order_id = 641);
SELECT t.kind, a.code, e.amount FROM ledger_transactions t
  JOIN ledger_entries e ON e.transaction_id = t.id JOIN accounts a ON a.id = e.account_id
  WHERE t.order_id = 641;
```

---

## 11. Các nhánh khác

### IPN không tới → `querydr` (ví dụ thật: đơn 637)

Khi chưa đăng ký IPN URL, VNPay không gọi IPN. Bước 7 thấy payment chưa có kết quả nên **api tự hỏi
VNPay** (`payments.reconcile.ts` → `vnpay/vnpay.querydr.ts`):

```http
POST https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
{ "vnp_RequestId": "...", "vnp_Version": "2.1.0", "vnp_Command": "querydr",
  "vnp_TmnCode": "...", "vnp_TxnRef": "637Tmvrl9fj42c1f4f",
  "vnp_TransactionDate": "20261028110241", "vnp_CreateDate": "...", "vnp_IpAddr": "127.0.0.1",
  "vnp_OrderInfo": "Truy van giao dich 637Tmvrl9fj42c1f4f",
  "vnp_SecureHash": "<HMAC-SHA512 các trường trên nối bằng |>" }
```

VNPay trả lời (đã kiểm chữ ký):

```json
{ "vnp_ResponseCode": "00", "vnp_Message": "QueryDR success", "vnp_TxnRef": "637Tmvrl9fj42c1f4f",
  "vnp_Amount": "88000000", "vnp_TransactionStatus": "00", "vnp_TransactionNo": "15717032", ... }
```

`vnp_TransactionStatus = 00` nên kết quả được áp dụng **bằng đúng hàm của IPN**
(`settleGatewayResult`): ghi vào database y như bước 6, chỉ khác `payment_notifications.source =
QUERY`. Điều kiện để hỏi: xem [`05-payments.md`](05-payments.md) và mục "Đối soát bằng querydr".

### Khách huỷ hoặc thẻ lỗi

IPN tới với `vnp_ResponseCode = 24` (huỷ) hoặc mã lỗi khác:

| Bảng                    | Ghi gì                                     |
| ----------------------- | ------------------------------------------ |
| `payments`              | FAILED + mã lỗi                            |
| `orders`                | FAILED                                     |
| `listings`              | **trả vé ngay**: `quantity_available + 1`  |
| `ledger_*`              | **không ghi gì** (không có tiền di chuyển) |
| `payment_notifications` | IPN, `00`                                  |

### Khách bỏ đi, không IPN, không quay về

Sau `expires_at` (15 phút), job chạy nền (`jobs/order-expiry.job.ts`, mỗi 60 giây) chuyển đơn sang
`EXPIRED`, payment sang `FAILED`, và trả vé.

### Tiền về sau khi đơn đã hết hạn

IPN hoặc `querydr` thành công mà đơn đã `EXPIRED`:

- vé vẫn còn → giữ lại vé, đơn `PAID`, ghi sổ như bước 6;
- vé đã bán cho người khác → đơn `REFUND_PENDING`, thêm dòng `refunds`, ghi sổ `LATE_PAYMENT`
  (+gateway_clearing / −buyer:3:refund_payable): sàn nợ hoàn tiền cho khách.

### VNPay gửi IPN nhiều lần

Lần sau thấy `payments.provider_response_code` đã có giá trị → trả `02`, **không ghi gì thêm**.
`idempotency_key` của sổ cái là lớp chặn thứ hai.

---

## 12. Bản đồ file

| Bước    | File                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1       | `apps/web/features/checkout/components/ticket-picker.tsx`                                                                           |
| 2       | `apps/web/features/checkout/actions.ts`, `apps/web/lib/api-client.ts`                                                               |
| 3       | `apps/api/src/modules/orders/orders.service.ts` (`createOrder`), `order-expiry.ts`                                                  |
| 4       | `apps/api/src/modules/payments/payments.service.ts`, `vnpay/vnpay.payment-url.ts`, `vnpay/vnpay.signature.ts`                       |
| 6       | `apps/api/src/modules/payments/payments.ipn.ts`, `payments.settlement.ts`, `modules/ledger/ledger.postings.ts`, `ledger.service.ts` |
| 7       | `apps/api/src/modules/payments/payments.return.ts`, `payments.reconcile.ts`                                                         |
| 8       | `apps/web/app/[locale]/orders/[id]/page.tsx`, `apps/api/src/modules/orders/orders.controller.ts`                                    |
| querydr | `apps/api/src/modules/payments/payments.reconcile.ts`, `vnpay/vnpay.querydr.ts`                                                     |
| Hết hạn | `apps/api/src/jobs/order-expiry.job.ts`, `modules/orders/order-expiry.ts`                                                           |
