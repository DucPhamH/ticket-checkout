**Kiểm tra input trong controller bằng zod.** `Schema.parse(req.params)` trả về giá trị có kiểu và
dùng lại được schema cho tài liệu OpenAPI; bộ xử lý lỗi biến `ZodError` thành
`400 VALIDATION_ERROR` kèm tên trường bị sai (`id: ...`).

**Sự kiện không còn mở bán thì không trả tin đăng.** Trang vẫn mở được bằng id, nhưng sự kiện đã
diễn ra hoặc đã huỷ thì không mua được, liệt kê vé ra sẽ gây hiểu nhầm.
