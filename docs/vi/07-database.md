# Cơ sở dữ liệu

[English](../07-database.md)

Mới làm quen? Đọc [Hướng dẫn đọc database](08-database-guide.md): có sơ đồ và giải thích từng bảng.

PostgreSQL 16 qua Prisma 7 (`apps/api/prisma/schema.prisma`, driver adapter `pg`). Hiện có một
migration: `prisma/migrations/*_init`. Nửa đầu do Prisma sinh; nửa sau là SQL viết tay cho những
quy tắc mà ngôn ngữ schema của Prisma không diễn đạt được.

## Bảng

```
users ─┬─< listings >── events
       │      │
       │      └─< orders ──1:1── payments ──< payment_notifications
       │            │                 │
       │            └──1:1── refunds ─┘
       │
       └─< accounts ──< ledger_entries >── ledger_transactions
                                             (có thể gắn với một đơn, sự kiện hoặc lần hoàn tiền)
```

| Bảng                                                | Mục đích                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `users`                                             | Người dùng demo; `role` là `USER` hoặc `ADMIN`.                                                                               |
| `events`                                            | `ACTIVE` → `COMPLETED` hoặc `CANCELLED`, mỗi trạng thái kèm mốc thời gian.                                                    |
| `listings`                                          | Vé của một người bán cho một sự kiện. `quantity_available` giảm khi có đơn giữ vé.                                            |
| `orders`                                            | Một lần mua. Giá và phí được chép vào lúc thanh toán và không bao giờ tính lại.                                               |
| `payments`                                          | Phía cổng thanh toán của đơn: `txn_ref` của mình, mã giao dịch và ngày thanh toán của VNPay (cần cho `querydr` và hoàn tiền). |
| `payment_notifications`                             | Mọi IPN, lần chuyển hướng về và lần tra cứu trạng thái, lưu nguyên văn trước khi xử lý.                                       |
| `refunds`                                           | Tối đa một lần hoàn (toàn bộ) cho mỗi đơn; thử lại cho tới khi thành công.                                                    |
| `accounts`, `ledger_transactions`, `ledger_entries` | Sổ cái bút toán kép, xem [Sổ cái](06-ledger.md).                                                                              |
| `account_balances` (view)                           | Số dư từng tài khoản, theo dấu tự nhiên của nó.                                                                               |

`orders` và `payments` được tách riêng có chủ đích: đơn hàng là đối tượng nghiệp vụ của mình,
còn payment là góc nhìn của một cổng thanh toán về đơn đó. Thêm cổng thứ hai sẽ không phải sửa
`orders`.

## Quy ước

- SQL dùng snake_case, TypeScript dùng camelCase (`@map`/`@@map`).
- Tiền là `BIGINT`, đơn vị đồng. Prisma trả về kiểu `bigint`; chỉ đổi sang `number` khi dựng
  response API (an toàn tới 9e15 VND).
- Thời gian là `timestamptz(3)`.
- Khoá chính là số nguyên tự tăng. Khoá ngoại dùng `ON DELETE RESTRICT`: không xoá được thứ mà
  tiền đang phụ thuộc vào.
- Mọi khoá ngoại đều có index (Postgres không tự tạo).

## Quy tắc do database đảm bảo

| Quy tắc                                                                                         | Cơ chế                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Trạng thái sự kiện khớp với `completed_at` / `cancelled_at`                                     | `CHECK`                                           |
| Giá tin đăng > 0; `0 ≤ quantity_available ≤ quantity_total`                                     | `CHECK`                                           |
| Đơn: `subtotal = unit_price × quantity`, `total = subtotal + buyer_fee`, phí nằm trong giới hạn | `CHECK`                                           |
| Số tiền thanh toán và hoàn tiền > 0                                                             | `CHECK`                                           |
| Dòng sổ cái khác 0                                                                              | `CHECK`                                           |
| Mỗi giao dịch sổ cái có ≥ 2 dòng và tổng bằng 0                                                 | trigger ràng buộc chạy trễ, kiểm tra lúc `COMMIT` |
| Dòng sổ cái không bao giờ bị sửa hay xoá                                                        | trigger `BEFORE UPDATE OR DELETE`                 |
| Một sự kiện nghiệp vụ chỉ ghi sổ tối đa một lần                                                 | `idempotency_key` duy nhất                        |
| Mỗi đơn có một payment và một refund; mã tham chiếu cổng là duy nhất                            | unique index                                      |

`test/db/constraints.test.ts` chứng minh từng quy tắc sổ cái và một số `CHECK` trên database
thật. Mỗi trường hợp chạy trong một transaction rồi rollback, dùng
`SET CONSTRAINTS ALL IMMEDIATE` để trigger chạy trễ được kích hoạt trước khi rollback.

## Các index đáng chú ý

| Index                                             | Phục vụ                                  |
| ------------------------------------------------- | ---------------------------------------- |
| `orders (status, expires_at)`                     | quét đơn đang chờ đã quá hạn giữ vé      |
| `orders (buyer_id, created_at DESC)`              | "đơn của tôi"                            |
| `listings (event_id, status)`                     | trang sự kiện                            |
| `ledger_entries (account_id)`                     | số dư của một tài khoản                  |
| `payment_notifications (payment_id, received_at)` | lịch sử thông báo của một lần thanh toán |

## Dữ liệu mẫu

`src/db/seed.ts` tạo bốn người dùng (hai người bán, một người mua, một admin), hai sự kiện, năm
tin đăng và ba tài khoản sổ cái của sàn. Seed an toàn khi chạy lại (bỏ qua nếu đã có người dùng)
và chạy trong container `migrate` (chạy một lần), sau `prisma migrate deploy`, trước khi api khởi động. Seed không bao giờ tạo đơn
hay dòng sổ cái: những thứ đó chỉ sinh ra từ luồng thật.

## Lệnh (chạy trong `apps/api`, hoặc thêm `-w @tc/api` khi chạy từ gốc)

```
npm run db:migrate    tạo/áp dụng migration khi phát triển
npm run db:deploy     áp dụng migration còn thiếu (Docker, CI)
npm run db:seed       tạo dữ liệu mẫu
npm run db:reset      xoá và dựng lại database dev
npm run db:studio     xem dữ liệu bằng Prisma Studio
```
