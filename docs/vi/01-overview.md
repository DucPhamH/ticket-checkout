# Tổng quan

[English](../01-overview.md)

Một lát cắt của sàn bán lại vé: người mua chọn một tin đăng, thanh toán qua VNPay, tiền được
sàn giữ hộ (escrow) cho đến khi sự kiện được đánh dấu là đã diễn ra.

## Các service

| Service | Cổng             | Vai trò                                                                                                                        |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `web`   | 3000             | Next.js. Render trang ở server, không chứa nghiệp vụ, không truy cập DB.                                                       |
| `api`   | 4000             | Express. Đơn hàng, thanh toán, sổ cái, thao tác quản trị. Thành phần duy nhất nói chuyện với Postgres. Tài liệu API ở `/docs`. |
| `db`    | 5432             | PostgreSQL 16.                                                                                                                 |
| `ngrok` | 4040 (inspector) | Tuỳ chọn (`--profile tunnel`). Cho api một URL công khai để VNPay gửi được IPN.                                                |

```
trình duyệt ──> web ──(gọi từ server)──> api ──> db
                                          ▲
VNPay ──(IPN)──> ngrok ───────────────────┘
VNPay ──(chuyển hướng trình duyệt)──> api /payments/vnpay/return ──> web /orders/:id
```

Trình duyệt chỉ nói chuyện với `web`, trừ một ngoại lệ: VNPay chuyển trình duyệt về return URL
của api; api kiểm tra chữ ký rồi chuyển tiếp sang trang kết quả của web. Vì web gọi api từ phía
server nên không cần cấu hình CORS, và cookie người dùng hiện tại không bao giờ rời khỏi domain
của web.

## Luồng mua vé

1. `GET /vi/events/1` – web render sự kiện và các tin đăng (SSR).
2. Người mua chọn tin đăng, số lượng rồi bấm thanh toán. Web gọi `POST /orders`.
3. Trong một transaction, api giữ vé và tạo đơn `PENDING`, rồi trả về URL thanh toán VNPay đã
   ký. Web chuyển trình duyệt sang đó.
4. Người mua trả tiền bằng thẻ test của sandbox.
5. VNPay gọi endpoint IPN. Đây là thứ duy nhất được phép chuyển đơn sang `PAID` và ghi sổ cái.
6. VNPay chuyển trình duyệt về. Trang kết quả đọc đơn từ database; nếu đơn vẫn `PENDING` thì
   hỏi thẳng VNPay (`querydr`) và tự làm mới cho tới khi có kết quả.
7. Admin đánh dấu sự kiện đã diễn ra; tiền escrow chuyển sang số dư khả dụng của người bán.

## Xem ở đâu

```
apps/api         backend Express
apps/web         frontend Next.js
packages/shared  tính phí, hằng số trạng thái, kiểu DTO dùng chung cho cả hai
docs/            tài liệu này
```
