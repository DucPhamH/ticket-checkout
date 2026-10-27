# Thanh toán (VNPay)

[English](../05-payments.md)

> Trạng thái: đã thiết kế, chưa làm (bước 6 trong kế hoạch).

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
