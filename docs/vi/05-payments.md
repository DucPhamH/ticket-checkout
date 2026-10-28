## Ký request (đã làm)

`modules/payments/vnpay/` làm theo VNPay 2.1.0, đọc ngày 2026-10-28:

- Tham số sắp xếp theo tên; mỗi giá trị được mã hoá URL, dấu cách thành `+` (kết quả chung của các
  mẫu PHP, Java và Node); nối `k=v&k=v`; HMAC-SHA512 bằng `vnp_HashSecret`, dạng hex.
- Chính chuỗi đó là query của URL, thêm `&vnp_SecureHash=...` ở cuối. Không gửi `vnp_SecureHashType`
  (bản 2.1.0); khi kiểm chữ ký thì bỏ qua nó cùng `vnp_SecureHash`.
- Số tiền ×100, ngày `yyyyMMddHHmmss` theo GMT+7, `vnp_OrderInfo` bỏ dấu và ký tự đặc biệt,
  `vnp_ExpireDate` = thời điểm hết giữ vé của đơn.
- So sánh chữ ký theo thời gian cố định (không lộ thông tin qua thời gian so sánh).
- Thanh toán chỉ thành công khi `vnp_ResponseCode` và `vnp_TransactionStatus` đều là `00`.

Kiểm chứng theo ba cách: test so với chữ ký HMAC tính độc lập bằng `openssl`; một URL đã ký (giá trị
có dấu cách và `:`/`/`) mở ra trang "Chọn phương thức thanh toán (Test)" của sandbox; cùng URL đó nhưng
sửa số tiền sau khi ký thì bị từ chối với mã lỗi 70 (sai chữ ký).

Credential được kiểm tra lúc server khởi động: thiếu hoặc sai định dạng `VNP_TMN_CODE` /
`VNP_HASH_SECRET` thì api ghi mọi vấn đề ở mức `FATAL` rồi dừng, thay vì để người mua đầu tiên gặp
lỗi. Bước kiểm tra nằm ở `index.ts` chứ không nằm trong cấu hình env dùng chung, nên seed, migration và
test không cần credential thật (test dùng credential giả).

Tự viết khoảng 40 dòng ký thay vì dùng gói npm cộng đồng `vnpay` (~4 nghìn lượt tải/tuần, một người
bảo trì): ít phụ thuộc bên thứ ba trong code xử lý tiền, và logic dễ đọc.
