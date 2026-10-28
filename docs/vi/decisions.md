**Đơn chưa thanh toán hết hạn ngay trong tiến trình api, không dùng worker hay cron riêng.** Lượt
quét mỗi 60 giây trong api, cộng với hết hạn khi đọc đơn và trước khi giữ vé, đủ để vé luôn được mở
bán lại mà không cần thêm hạ tầng. Việc này idempotent nên chạy nhiều bản api vẫn an toàn; khi quy
mô lớn hơn thì chuyển sang một worker riêng hoặc job do database lên lịch.
