# Monorepo

[English](../02-monorepo.md)

Dùng npm workspaces, gồm ba package:

| Package      | Đường dẫn         | Phụ thuộc vào        |
| ------------ | ----------------- | -------------------- |
| `@tc/shared` | `packages/shared` | không có gì lúc chạy |
| `@tc/api`    | `apps/api`        | `@tc/shared`         |
| `@tc/web`    | `apps/web`        | `@tc/shared`         |

## Package dùng chung

Chỉ chứa những thứ cả hai bên bắt buộc phải thống nhất:

- tỉ lệ phí và `calculateOrderAmounts()` – số tiền người mua thấy trên màn hình trùng với số api
  gửi sang VNPay và ghi vào sổ cái, vì chỉ có một cách tính duy nhất;
- các enum trạng thái (`OrderStatus`, `EventStatus`, …);
- kiểu DTO – api đổi hình dạng dữ liệu trả về thì web không biên dịch được nữa.

Package này phải an toàn khi gửi xuống trình duyệt: không Prisma, không React, không
`process.env`. ESLint kiểm tra điều này (xem `packages/shared/eslint.config.mjs`).

Nó được biên dịch ra `dist/` và dùng như mọi package npm khác, nên phải build trước các app:
`npm run build` đã làm đúng thứ tự.

## node_modules

npm gom thư viện lên `node_modules` ở gốc và tạo symlink cho các workspace
(`node_modules/@tc/shared -> packages/shared`). Node tìm thư viện bằng cách đi ngược lên từ file
đang import, nên `apps/api/src/app.ts` tìm thấy `express` ở thư mục gốc.

Điểm cần cẩn thận: một thư viện chỉ web khai báo vẫn import được từ api trên máy dev. Trong
Docker thì vỡ, vì mỗi image chỉ cài thư viện của chính nó. Luật
`import/no-extraneous-dependencies` bắt lỗi này ngay lúc lint.

## Build Docker

Mỗi Dockerfile build từ gốc repo (`context: .`) để nhìn thấy `packages/shared`.

1. Copy mọi `package.json` cùng lockfile. `npm ci` đối chiếu lockfile với tất cả workspace,
   nên vẫn cần file khai báo của app kia dù không cần code của nó.
2. `npm ci --workspace @tc/api` chỉ cài cây thư viện của api.
3. Copy code, build shared, build app.

Copy file khai báo trước code giúp Docker dùng lại lớp đã cài thư viện khi chỉ có code thay đổi.
`.dockerignore` loại `node_modules` của máy dev: image chạy Alpine (musl), máy dev thì không.

Hạn chế đã biết: image hiện build một giai đoạn và còn giữ công cụ build (api ~500 MB, web
~1,3 GB). Build nhiều giai đoạn (multi-stage) kết hợp `output: 'standalone'` của Next sẽ đưa cả
hai xuống khoảng 200 MB.

## Lệnh

```
npm run build      shared -> api -> web
npm run test       test của api (gồm cả phần tính phí trong shared)
npm run lint       mọi workspace
npm run typecheck  mọi workspace
npm run format     Prettier (kèm sắp xếp class Tailwind)
```

## CI

`.github/workflows/ci.yml` chạy ở mỗi lần push: kiểm tra format, lint, typecheck, test (trên một
container Postgres), build production và `docker compose build`.
