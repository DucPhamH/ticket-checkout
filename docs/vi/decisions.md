# Các quyết định

[English](../decisions.md)

Những chỗ đề bài bỏ ngỏ. Mới nhất ở cuối.

**Chọn VNPay làm cổng thanh toán.** Xem [Thanh toán](05-payments.md#vì-sao-chọn-vnpay).

**Tách api Express thay vì dùng route handler của Next.js.** Giữ logic tiền ngoài tiến trình
giao diện, đúng nghĩa đen "một backend Node.js", và test được api mà không cần trình duyệt. Cái
giá: thêm một service và một bước gọi HTTP nội bộ.

**Web chỉ gọi api từ phía server.** Không CORS, không lộ URL api ra trình duyệt, cookie người
dùng chỉ nằm trên một domain.

**Không đăng nhập; người dùng hiện tại lưu trong cookie.** Đề bài cho phép. Web chuyển tiếp nó
qua `X-User-Id`. Ai cũng giả làm người khác được; chấp nhận cho bản demo và được liệt kê là chưa
sẵn sàng cho production.

**Tiền là số nguyên VND.** Không dùng số thực ở bất kỳ đâu. Phí tính trên tạm tính của đơn theo
đơn vị basis point, làm tròn nửa lên; phần của sàn là phần còn lại.

**Tính phí trên tạm tính, không tính theo từng vé.** Ít bước làm tròn hơn, một nguồn sự thật.

**Giữ vé 15 phút** khi tạo đơn, khớp với `vnp_ExpireDate` của VNPay. Đơn hết hạn thì trả vé.

**Phí của sàn được ghi nhận khi sự kiện diễn ra.** Giữ ở `fee_pending` cho tới lúc đó, để nếu
huỷ thì hoàn đủ tiền cho người mua.

**Thanh toán trễ được hoàn tiền, không bị bỏ qua.** Xem [Thanh toán](05-payments.md#xử-lý-ipn).

**Dùng ngrok với domain cố định thay vì Cloudflare quick tunnel.** IPN URL của VNPay được cấu hình
theo merchant nên không được đổi giữa các lần chạy. Gói miễn phí của ngrok có một domain cố định;
Cloudflare thì cần mua tên miền mới làm được vậy.

**Phạm vi thêm: huỷ sự kiện + hoàn tiền, người bán tự đăng tin.** Không bắt buộc; thêm vào vì
chúng kiểm tra sổ cái theo cả hai chiều.

**Chia thư mục theo tính năng, có luật import được kiểm tra tự động.** Xem
[Frontend](04-frontend.md#quy-tắc-import).

**ESLint 9, không phải 10.** `eslint-plugin-import` chưa hỗ trợ ESLint 10.

**Tắt file dành cho AI của Next.js** (`agentRules: false`). Next 16 tự ghi `AGENTS.md` khi chạy
`next dev`; repo không giữ các file do công cụ sinh ra.

**Prisma 7 (ổn định), không phải 8.** npm đang gắn nhãn `latest` cho một bản 8.0 thử nghiệm
(release candidate); 7.10 là bản ổn định mới nhất.

**Quy tắc dữ liệu được lặp lại trong SQL.** Ràng buộc `CHECK` và trigger sổ cái là lớp bảo vệ
thứ hai sau code, nên bug cũng không ghi được đơn sai hay sổ cái lệch.

**Tách `payments` khỏi `orders`.** Xem [Cơ sở dữ liệu](07-database.md#bảng).

**Khoá chính là số nguyên.** Đơn giản, dễ đọc cho bản demo. Mã đơn tăng dần trên URL sẽ là vấn
đề khi có người dùng thật (dò được đơn của người khác); có đăng nhập và kiểm tra quyền sở hữu thì
bớt nghiêm trọng, và có thể thêm một mã công khai ngẫu nhiên.

**Tài liệu OpenAPI sinh từ schema zod.** Một nguồn sự thật cho cả validate lẫn tài liệu, thay vì
YAML viết tay hay comment JSDoc dễ bị lệch.

**Danh sách sự kiện công khai chỉ hiện sự kiện đang mở bán**, gần nhất trước. Sự kiện đã diễn ra
hoặc đã huỷ không mua được nữa; trang của chúng vẫn mở được bằng id, và admin có danh sách riêng.
`minPrice` và `ticketsAvailable` chỉ tính các tin đăng đang bán và còn vé, bằng một câu truy vấn
`GROUP BY` thay vì tải mọi tin đăng.
