# Sổ cái

[English](../06-ledger.md)

> Trạng thái: bảng, ràng buộc, trigger, service ghi bút toán, truy vấn số dư, giải ngân, huỷ sự kiện
> và hoàn tiền đã làm và có test.

Mỗi lần tiền di chuyển là một giao dịch bút toán kép (double-entry). Số dư không bao giờ được
lưu sẵn; nó là tổng các dòng trong sổ cái.

## Bảng

- `accounts` – mỗi mã tài khoản một dòng.
- `ledger_transactions` – mỗi sự kiện nghiệp vụ một dòng, có `idempotency_key` duy nhất (ví dụ
  `capture:order:42`), nên chạy lại cũng không ghi hai lần.
- `ledger_entries` – các dòng bút toán. `amount` là BIGINT có dấu, đơn vị VND: dương là Nợ
  (debit), âm là Có (credit).

Một trigger ràng buộc chạy trễ (deferred) kiểm tra tổng các dòng của mỗi giao dịch bằng 0 lúc
commit, nên code có bug cũng không ghi được giao dịch lệch. Một trigger khác khiến cả hai bảng
sổ cái chỉ được thêm. View `account_balances` cho ra mọi số dư bằng một câu truy vấn.

## Tài khoản

| Mã                          | Loại        | Ý nghĩa                                              |
| --------------------------- | ----------- | ---------------------------------------------------- |
| `platform:gateway_clearing` | tài sản     | tiền VNPay đang thu hộ mình                          |
| `seller:{id}:pending`       | nợ phải trả | tiền của người bán đang giữ trong escrow             |
| `seller:{id}:available`     | nợ phải trả | đã giải ngân cho người bán                           |
| `buyer:{id}:refund_payable` | nợ phải trả | đang nợ hoàn cho người mua                           |
| `platform:fee_pending`      | nợ phải trả | phí của sàn, chưa được ghi nhận (sự kiện có thể huỷ) |
| `platform:fee_revenue`      | doanh thu   | phí của sàn, đã ghi nhận                             |

Số dư tài khoản tài sản = tổng amount; số dư tài khoản nợ phải trả hoặc doanh thu = âm của tổng.

## Bút toán

Ví dụ đơn: 2 vé × 500.000 = tạm tính 1.000.000; người mua trả 1.100.000; người bán nhận 950.000;
sàn giữ 150.000.

| Sự kiện                                       | Nợ                                          | Có                                            |
| --------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| `PAYMENT_CAPTURED` (IPN thành công)           | gateway_clearing 1.100.000                  | seller pending 950.000; fee_pending 150.000   |
| `EVENT_SETTLED` (sự kiện đã diễn ra)          | seller pending 950.000; fee_pending 150.000 | seller available 950.000; fee_revenue 150.000 |
| `ORDER_CANCELLED` (sự kiện bị huỷ)            | seller pending 950.000; fee_pending 150.000 | buyer refund_payable 1.100.000                |
| `LATE_PAYMENT` (trả tiền sau khi đơn hết hạn) | gateway_clearing 1.100.000                  | buyer refund_payable 1.100.000                |
| `REFUND_COMPLETED` (VNPay hoàn tiền xong)     | buyer refund_payable 1.100.000              | gateway_clearing 1.100.000                    |

Vì sao phí nằm ở `fee_pending` trước: cho tới khi sự kiện diễn ra, giao dịch vẫn có thể bị đảo
ngược, nên đó chưa phải doanh thu.

## Bất biến

- Mỗi giao dịch có tổng bằng 0 (trigger trong DB).
- Toàn bộ sổ cái có tổng bằng 0 (trang quản trị hiển thị dưới dạng bảng cân đối thử).
- Với mọi đơn, `total = sellerPayout + platformRevenue`; phần của sàn được tính bằng phần còn lại
  nên làm tròn không bao giờ làm mất một đồng (test trong `test/shared/fees.test.ts`).
- Số tiền là số nguyên từ đầu tới cuối. VND không có đơn vị lẻ; phép ×100 của VNPay chỉ áp dụng
  khi dựng URL thanh toán.

## Service ghi bút toán (đã làm)

`modules/ledger/ledger.service.ts`. Nơi gọi mô tả việc tiền di chuyển bằng các dòng `debit`/`credit`
trên những tài khoản khai báo trong `constants/ledger.ts`:

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

- Chạy trong transaction của nơi gọi, nên việc ghi tiền commit cùng lúc với thay đổi nghiệp vụ gây ra nó.
- Kiểm tra ≥ 2 dòng, không có dòng 0, tổng bằng 0 trước khi ghi; database kiểm tra thêm lần nữa.
- Tự tạo tài khoản của người dùng (ví dụ `seller:2:pending`) ở lần dùng đầu tiên.
- Idempotent: dòng giao dịch được chèn bằng `ON CONFLICT (idempotency_key) DO NOTHING`. Gọi lại thì
  không ghi gì và trả về giao dịch cũ với `created: false`; nếu có nơi khác đang ghi cùng key thì nơi
  gọi sau chờ nơi trước xong rồi không làm gì.

Test chạy trong transaction được rollback, vì dòng sổ cái không xoá được.

## Đọc số dư (đã làm)

`modules/ledger/ledger.balances.ts` cộng lại các dòng sổ cái mỗi lần gọi; không lưu sẵn số dư.

- `getUserBalances(userId)` → đang giữ, khả dụng, đang hoàn (`GET /me/balances`). Tài khoản người
  dùng chưa từng dùng thì tính là 0.
- `getTrialBalance()` → mọi tài khoản theo dấu đã lưu (+ Nợ, − Có) và tổng, luôn phải bằng 0
  (`GET /admin/trial-balance`).
- `ledger.history.ts`: các dòng trên tài khoản của một người dùng, mới nhất trước, phân trang theo
  id dòng (`GET /me/ledger`).

## Giải ngân sự kiện (đã làm)

`POST /admin/events/:id/complete` (`modules/events/event-completion.ts`), trong một transaction:

1. Khoá dòng sự kiện `FOR UPDATE`, chuyển sang `COMPLETED`.
2. Với mỗi đơn `PAID` của sự kiện, ghi `EVENT_SETTLED` với key `settle:order:<id>`. Gọi lại thì
   không ghi thêm gì.

Tình huống phải chịu được: một thanh toán thành công đúng lúc đó. Nếu tiền vào `seller:pending`
sau khi bước 2 đã đọc danh sách đơn, nó sẽ không bao giờ được giải ngân. Vì vậy tạo đơn và ghi
nhận thanh toán thành công đều khoá `FOR SHARE` dòng sự kiện (`events/event-lock.ts`):

- thanh toán khoá trước → đơn đã `PAID` trước khi bước 2 đọc danh sách, và được giải ngân;
- giải ngân khoá trước → thanh toán thấy sự kiện không còn `ACTIVE`, nên ghi nợ hoàn tiền cho khách
  (bút toán `LATE_PAYMENT`, lý do hoàn `EVENT_ENDED`) thay vì đưa tiền vào escrow.

Với thanh toán, thứ tự khoá luôn là đơn → payment → sự kiện; giải ngân chỉ khoá sự kiện, nên hai
bên không thể chờ nhau thành vòng (deadlock). `test/modules/event-completion.test.ts` cho hai việc
chạy đua 10 lần; bỏ khoá chia sẻ thì có tiền bị kẹt trong escrow.

## Huỷ sự kiện và hoàn tiền (đã làm)

`POST /admin/events/:id/cancel` (`modules/events/event-cancellation.ts`):

1. Một transaction, khoá sự kiện `FOR UPDATE` như trên: sự kiện thành `CANCELLED`; mỗi đơn `PAID`
   thành `REFUND_PENDING`, có một dòng `refunds` (lý do `EVENT_CANCELLED`) và bút toán
   `ORDER_CANCELLED` (key `cancel:order:<id>`) đưa tiền ra khỏi escrow, vào `refund_payable` của
   người mua.
2. Sau khi commit, từng khoản hoàn được gửi tới VNPay (`payments/payments.refund.ts`). Thành công
   thì ghi `REFUND_COMPLETED` (key `refund:<id>`) và đơn thành `REFUNDED`. VNPay từ chối hoặc không
   gọi được thì khoản hoàn ở trạng thái `FAILED` kèm `last_error`; admin bấm gửi lại ở danh sách
   hoàn tiền (`POST /admin/refunds/:id/retry`). Việc huỷ không bao giờ bị đảo ngược.

Dòng `refunds` bị khoá `FOR UPDATE` trong lúc chờ VNPay trả lời, nên bấm gửi lại hai lần cùng lúc
chỉ gửi một lần (có test). Khoản hoàn do thanh toán trễ (`LATE_PAYMENT`, `EVENT_ENDED`) đi cùng
đường này. Chỉ huỷ được sự kiện chưa bắt đầu (409 `EVENT_STARTED`): đã bắt đầu thì phải đánh dấu đã diễn
ra, và sự kiện đã diễn ra thì escrow đã giải ngân cho người bán.
