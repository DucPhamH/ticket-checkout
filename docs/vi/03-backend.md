## Tác vụ chạy nền

`jobs/order-expiry.job.ts` quét các đơn chưa thanh toán đã quá 15 phút giữ vé, một lần lúc khởi
động rồi mỗi 60 giây: chúng chuyển sang `EXPIRED` và vé được mở bán lại. Cùng hàm đó cũng chạy cho
một đơn khi đơn được đọc (`GET /orders/:id`) và cho một tin đăng ngay trước khi giữ vé, nên không ai
phải đợi tới lượt quét kế tiếp.

Hết hạn là một câu SQL duy nhất (`modules/orders/order-expiry.ts`): một truy vấn `WITH` vừa chuyển
đơn sang hết hạn, vừa cộng vé theo từng tin đăng và mở bán lại. Đo trên 1 triệu đơn: 1.000 đơn quá
hạn trên 1.000 tin đăng mất ~22 ms (cách cũ mỗi tin một câu UPDATE mất ~550 ms). Giải thích từng
dòng ở [Khái niệm database](09-database-concepts.md#8-with-cte--gộp-nhiều-bước-vào-một-câu-sql). Đơn được chọn bằng `FOR UPDATE SKIP LOCKED` theo từng lô 1.000 đơn (mỗi lô một transaction), nên
lượt quét không bao giờ đứng chờ đơn đang bị transaction khác khoá, và không giữ nhiều khoá lâu. Vì
chỉ khớp đơn `PENDING` nên chạy hai lần, hay nhiều bản api cùng lúc, cũng không bao giờ trả vé hai
lần (test chạy ba lượt quét song song, giữ khoá một đơn để chứng minh nó bị bỏ qua, và kiểm tra chia
lô). Nếu có lúc nào nó định làm vậy, ràng buộc
`quantity_available <= quantity_total` sẽ từ chối.
