# Thanh toán (VNPay)

[English](../05-payments.md)

> Trạng thái: phần ký, tạo payment, return URL và IPN đã làm. IPN được thử ở máy bằng script giả lập;
> nhận IPN thật từ VNPay qua tunnel và đối soát `querydr` làm tiếp theo.

## Vì sao chọn VNPay

Dùng VND gốc, là cổng phổ biến nhất ở Việt Nam, đăng ký sandbox có ngay, và có đủ những gì đề
bài cần: chuyển hướng trình duyệt, IPN gọi từ server sang server, API tra cứu để đối soát, và API
hoàn tiền.

## Luồng

1. `POST /orders` tạo đơn `PENDING` và dựng URL thanh toán gồm `vnp_Amount` (VND × 100),
   `vnp_TxnRef` (mã tham chiếu của mình), `vnp_ExpireDate` (15 phút, bằng thời gian giữ vé),
   `vnp_ReturnUrl`; ký bằng HMAC-SHA512 trên chuỗi query đã sắp xếp.
2. Trình duyệt sang VNPay, người mua trả bằng thẻ sandbox.
3. **IPN** (`GET /payments/vnpay/ipn`, server gọi server) – nguồn sự thật.
4. **Return** (`GET /payments/vnpay/return`, trình duyệt) – chỉ để hiển thị.

## Xử lý IPN

Mọi lần gọi đều được lưu vào `payment_notifications` trước tiên, sau đó:

| Kiểm tra                                                             | Trả về                                      |
| -------------------------------------------------------------------- | ------------------------------------------- |
| Chữ ký sai                                                           | `97`                                        |
| Không tìm thấy đơn                                                   | `01`                                        |
| Số tiền khác với đơn                                                 | `04`                                        |
| Đơn đã xử lý rồi                                                     | `02` (idempotent: không ghi sổ cái lần hai) |
| Mã thành công: chuyển `PAID`, ghi sổ cái, trong cùng một transaction | `00`                                        |
| Mã thất bại: chuyển `FAILED`, trả vé                                 | `00`                                        |
| Lỗi bất ngờ                                                          | `99`                                        |

VNPay ngừng gọi lại khi nhận `00` hoặc `02`; nếu không, nó gọi lại tối đa 10 lần, mỗi lần cách
nhau 5 phút.

Tình huống hiếm: thanh toán thành công sau khi đơn đã hết hạn giữ vé và vé đã bán cho người
khác. Tiền đã bị trừ thật, nên vẫn được ghi nhận (`LATE_PAYMENT`) và chuyển thành khoản phải
hoàn cho người mua chứ không bị bỏ qua.

## Return URL và đối soát

Không bao giờ tin return URL để thay đổi trạng thái: người dùng có thể đóng tab hoặc tự sửa
query. Api kiểm tra chữ ký; nếu đơn vẫn `PENDING` (IPN tới muộn hoặc không tới) thì gọi
`querydr` của VNPay và áp kết quả qua đúng đường xử lý của IPN. Sau đó chuyển sang trang kết
quả của web, trang này đọc đơn từ database.

Điều này quan trọng khi chạy local: IPN URL được cấu hình theo merchant ở phía VNPay, nên nếu
reviewer chạy project bằng credential sandbox của mình, IPN sẽ về tunnel của mình chứ không về
máy họ. Nhờ `querydr`, trang kết quả trên máy họ vẫn đúng.

## Nhận IPN khi chạy local

VNPay phải gọi được tới api qua HTTPS. `docker compose --profile tunnel up` bật ngrok với một
domain miễn phí cố định (`NGROK_DOMAIN`), nên IPN URL đăng ký với VNPay không bao giờ phải đổi.
Trang inspector của ngrok ở `http://localhost:4040` hiện mọi request IPN.

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

## Tạo payment (đã làm)

`POST /orders` tạo đơn cùng dòng `payments` trong một transaction, rồi trả `{ order, paymentUrl }`;
web chuyển trình duyệt sang `paymentUrl`.

- `vnp_TxnRef` có dạng `<mã đơn>T<thời gian hệ 36><ngẫu nhiên>`: không trùng kể cả sau khi reset
  database, lúc mã đơn đếm lại từ đầu mà VNPay vẫn nhớ các mã của hôm trước.
- `vnp_Amount` là tổng tiền của đơn; `vnp_ExpireDate` là `expires_at` của đơn, nên hạn thanh toán và
  hạn giữ vé kết thúc cùng lúc.
- `vnp_Locale` theo ngôn ngữ trang (`vi` → `vn`), và return URL mang theo nó
  (`/payments/vnpay/return/vi`) để người mua quay về đúng ngôn ngữ.
- `vnp_IpAddr` là địa chỉ của người mua do web chuyển qua header `X-Forwarded-For` (nếu không, api chỉ
  thấy địa chỉ của web); localhost IPv6 được đổi thành `127.0.0.1` cho vừa giới hạn 7–45 ký tự của
  VNPay.
- Khi đơn hết hạn, payment `PENDING` của nó chuyển `FAILED` ngay trong cùng câu lệnh.

## Return URL (đã làm)

`GET /payments/vnpay/return/:locale` (`modules/payments/payments.return.ts`):

1. Kiểm tra `vnp_SecureHash`.
2. Tìm payment theo `vnp_TxnRef`.
3. Lưu nguyên văn mọi tham số vào `payment_notifications` (`source = RETURN`) kèm `signature_valid` và
   kết luận: `REPORTED_SUCCESS` (`vnp_ResponseCode` và `vnp_TransactionStatus` đều `00`),
   `REPORTED_FAILURE`, `INVALID_SIGNATURE` hoặc `UNKNOWN_PAYMENT`.
4. Chuyển về `/<locale>/orders/<mã đơn>` (về trang chủ nếu mã tham chiếu lạ). Địa chỉ chuyển hướng chỉ
   được ghép từ cấu hình và mã lấy từ database, không bao giờ từ query, nên không bị lợi dụng để chuyển
   người dùng sang trang khác (open redirect).

Endpoint này không bao giờ đổi trạng thái đơn hay payment. Đã thử với sandbox và thẻ test NCB: chữ ký
VNPay gửi về được xác thực đúng, kết luận `REPORTED_SUCCESS`, và đơn vẫn `PENDING` cho tới khi có IPN.
Đơn đó sau đó hết hạn, đúng lỗ hổng mà IPN và `querydr` sẽ lấp.

## IPN (đã làm)

`GET /payments/vnpay/ipn` (`modules/payments/payments.ipn.ts`), luôn trả HTTP 200 với
`{ RspCode, Message }`:

1. Thiếu tham số → `99`; sai chữ ký → `97`; `vnp_TxnRef` lạ → `01`.
2. Trong một transaction, khoá đơn rồi mới khoá payment (cùng thứ tự với lượt quét hết hạn, nên hai bên
   không bao giờ deadlock, và IPN trùng phải xếp hàng): số tiền ≠ payment × 100 → `04`; đã áp dụng kết
   quả từ cổng rồi → `02`.
3. Thành công (`vnp_ResponseCode` và `vnp_TransactionStatus` đều `00`):
   - đơn vẫn `PENDING` (kể cả đã quá `expires_at`, vé vẫn đang được giữ) → `PAID`, payment `SUCCEEDED`,
     ghi sổ `PAYMENT_CAPTURED`;
   - đơn `EXPIRED` nhưng vé vẫn còn bán → giữ lại vé, xử lý như trên;
   - đơn `EXPIRED` và vé đã hết → đơn `REFUND_PENDING`, tạo dòng `refunds`, ghi sổ `LATE_PAYMENT` (nợ
     hoàn người mua).
4. Thất bại → payment `FAILED`; đơn còn `PENDING` thì chuyển `FAILED` và trả vé ngay.
5. Trả `00` khi đã xử lý xong. Lỗi bất ngờ thì huỷ toàn bộ transaction và trả `99`, để VNPay gọi lại.

Mọi lần gọi đều được lưu vào `payment_notifications` (`source = IPN`) kèm mã mình đã trả lời, ở ngoài
transaction xử lý nên vẫn còn kể cả khi transaction bị huỷ.

Đã test: thành công kèm đúng từng dòng sổ cái, IPN gửi lặp và gửi đồng thời (chỉ ghi sổ một lần, sau đó
`02`), thanh toán sau `expires_at`, cứu đơn sau khi hết hạn, nợ hoàn tiền khi vé đã bán cho người khác,
ba mã thất bại, và `97`/`01`/`04`/`99`.

Ở máy local, `npm run vnpay:simulate-ipn -w @tc/api -- <mã đơn> [mã kết quả]` đóng vai VNPay: ký một IPN
bằng secret thật rồi gửi tới api đang chạy.
