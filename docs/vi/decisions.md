**Thiếu credential thanh toán thì dừng ngay.** Api không khởi động nếu thiếu credential VNPay hợp lệ,
để lỗi cấu hình lộ ra ngay lúc deploy chứ không phải lúc có người thanh toán đầu tiên. Bước kiểm tra
nằm ở điểm khởi động server, nên seed, migration và test vẫn chạy được mà không cần chúng.
