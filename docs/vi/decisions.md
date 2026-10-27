**Chống bán quá số vé bằng một lệnh UPDATE có điều kiện**
(`quantity_available = quantity_available - n WHERE quantity_available >= n`) trong transaction tạo
đơn; Postgres khoá dòng nên các người mua đồng thời phải xếp hàng. Test bắn 2 rồi 10 request cùng
lúc vào những vé cuối, và sẽ đỏ nếu đổi cách giữ vé thành "đọc rồi ghi".

**Admin không mua vé được** (403 `ADMIN_CANNOT_BUY`): admin là tài khoản vận hành. **Người bán không
mua được vé của chính mình** (409 `OWN_LISTING`). **Tối đa 10 vé mỗi đơn**, giới hạn này dùng chung
cho nút tăng số lượng trên giao diện và phần kiểm tra ở api.

**Đơn của người khác trả 404 chứ không phải 403**, để không dò được mã đơn.

**Các file test api chạy lần lượt** trên database dev dùng chung; mỗi file tự tạo và tự xoá dữ liệu
tạm có gắn nhãn.
