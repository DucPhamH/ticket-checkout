# Sổ cái

[English](../06-ledger.md)

> Trạng thái: bảng, ràng buộc, trigger và service ghi bút toán đã làm và có test. Truy vấn số dư làm
> cùng trang Ví.

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
