# Tài liệu kiến trúc

[English](../README.md)

Nếu mới làm quen với codebase, nên đọc theo thứ tự:

1. [Tổng quan](01-overview.md) – thành phần nào chạy ở đâu, một request đi qua những đâu
2. [Monorepo](02-monorepo.md) – workspaces, package dùng chung, cách build Docker
3. [Backend](03-backend.md) – cấu trúc module Express, xử lý lỗi, Swagger
4. [Frontend](04-frontend.md) – chia thư mục theo tính năng, quy tắc import, đa ngôn ngữ
5. [Thanh toán](05-payments.md) – chuyển hướng sang VNPay, IPN, đối soát
6. [Sổ cái](06-ledger.md) – tài khoản, bút toán, các bất biến
7. [Cơ sở dữ liệu](07-database.md) – bảng, ràng buộc, index, dữ liệu mẫu
8. [Các quyết định](decisions.md) – những chỗ đề bài bỏ ngỏ và lý do chọn
9. [Hướng dẫn đọc database](08-database-guide.md) – sơ đồ, giải thích từng bảng, một lần mua vé đi qua các bảng, câu hỏi tự kiểm tra
10. [Khái niệm database](09-database-concepts.md) – ràng buộc, index, transaction, khoá dòng, trigger, PL/pgSQL, view, migration; giải thích từng dòng SQL viết tay
11. [Luồng thanh toán từ đầu đến cuối](10-payment-flow.md) – bấm thanh toán → ghi bảng nào → gọi VNPay thế nào → IPN → Return, kèm dữ liệu thật của một đơn

Vận hành: [Chạy app và xem log](running.md).

Tài liệu mô tả thiết kế. Phần nào đã thiết kế nhưng chưa làm sẽ được ghi rõ.
