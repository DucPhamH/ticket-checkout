# Backend (apps/api)

[English](../03-backend.md)

Express 5 + TypeScript. Chia theo tính năng, không chia theo loại file.

```
src/
  index.ts            chỉ bật server
  app.ts              dựng app (middleware + router); test import thẳng file này
  config/env.ts       đọc biến môi trường bằng zod; thiếu biến nào là dừng ngay khi khởi động
  constants/          hằng số nghiệp vụ (thời gian giữ vé, mã tài khoản sổ cái)
  db/                 Prisma client (sinh vào src/generated, không commit)
  lib/                tiện ích nhỏ, không phụ thuộc framework (HttpError, money)
  middlewares/        người dùng hiện tại, not-found, xử lý lỗi
  openapi/            ghép tài liệu OpenAPI và hai route /docs, /openapi.json
  modules/<tính năng>/
    <x>.router.ts      khai báo route -> controller
    <x>.controller.ts  đọc request, gọi service, trả response
    <x>.service.ts     nghiệp vụ; tầng duy nhất chạm vào DB
    <x>.schema.ts      schema zod cho dữ liệu vào và ra
    <x>.openapi.ts     tài liệu OpenAPI của module, dựng từ chính các schema đó
test/                 cấu trúc giống src/
```

Module đã làm: `health`, `users`, `events`, `orders` (tạo, xem). Tiếp theo: đơn hết hạn,
`payments`, `ledger`, `listings`, `admin`, mỗi module được thêm khi làm tới tính năng cần nó.

## Vòng đời một request

```
router -> [currentUser] -> controller -> service -> db
                              │  kiểm tra input bằng zod (ZodError -> 400 VALIDATION_ERROR)
                              └─ service/controller ném HttpError (404, 409, ...)
                                   -> errorHandler -> { error: { code, message } }
```

Input được kiểm tra ngay trong controller bằng chính schema zod mà tài liệu OpenAPI dùng:

```ts
const { id } = EventIdParamsSchema.parse(req.params); // id: number, số nguyên dương
```

Kiểm tra trong controller (thay vì một middleware chung) giữ được kiểu dữ liệu TypeScript của giá
trị đã kiểm tra, và Express 5 không cho ghi đè `req.query`.

Mọi lỗi trả ra từ api đều cùng một dạng:

```json
{ "error": { "code": "LISTING_SOLD_OUT", "message": "Only 1 ticket left" } }
```

`code` cố định, dành cho máy đọc (web dùng nó để hiện thông báo đã dịch); `message` dành cho log
và lập trình viên. Lỗi không lường trước trở thành `500 INTERNAL_ERROR`, được ghi log và không
để lộ chi tiết ra ngoài.

Express 5 tự chuyển promise bị reject trong handler async sang bộ xử lý lỗi, nên handler không
cần try/catch.

## Người dùng hiện tại

Không có đăng nhập, đề bài cho phép. Web gửi header `X-User-Id`; middleware `currentUser`
(`middlewares/current-user.ts`) nạp người dùng và gán vào `req.currentUser`, hoặc trả 401 với
`MISSING_USER_ID`, `INVALID_USER_ID` hay `UNKNOWN_USER`. Chỉ route nào cần người dùng mới dùng
middleware này (hiện là `GET /me`). Route quản trị sẽ kiểm tra thêm vai trò.

Trong Swagger UI, bấm **Authorize** và nhập id người dùng (1–4) để mọi lần gọi đều gửi header.

## Tài liệu API (OpenAPI / Swagger)

- Swagger UI: http://localhost:4000/docs
- File spec gốc: http://localhost:4000/openapi.json (OpenAPI 3.1, import được vào Postman)

Spec được `zod-openapi` sinh ra từ chính các schema zod mà route dùng để validate, nên tài liệu
không thể lệch khỏi hành vi thật. Schema response được khai báo kèm
`satisfies z.ZodType<Dto>` với kiểu DTO trong `@tc/shared`: hợp đồng đổi mà schema không đổi theo
thì build lỗi.

Thêm một endpoint gồm: viết schema zod trong `<x>.schema.ts`, mô tả route trong
`<x>.openapi.ts`, rồi thêm các path đó vào `src/openapi/document.ts`.
`test/modules/openapi.test.ts` kiểm tra spec được phục vụ và có đủ path của mọi module.

## Ghi log

`pino` cùng `pino-http`: mỗi request một dòng (phương thức, đường dẫn, mã trạng thái, thời gian,
người gọi, mã request), mức log theo mã trạng thái. Lỗi bất ngờ được bộ xử lý lỗi ghi kèm stack.
`LOG_SQL=true` in ra mọi câu SQL. Xem [Chạy app và xem log](running.md).
