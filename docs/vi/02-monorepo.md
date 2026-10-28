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
4. Chỉ copy những gì cần để chạy sang một `node:22-alpine` mới (multi-stage):
   - **api**: giai đoạn `prod-deps` cài lại với `--omit=dev --omit=optional --omit=peer`
     (`optional` là cần thiết: lockfile đánh dấu prisma CLI là peer tuỳ chọn của `@prisma/client`),
     cộng thêm `dist/`. Migration và seed chạy trong service `migrate` riêng, chạy một lần rồi
     thoát, build từ giai đoạn `build` (có prisma CLI); `api` chỉ khởi động khi `migrate` xong.
   - **web**: `output: 'standalone'` của Next lần theo các file server cần (tính từ gốc monorepo
     nên có cả `@tc/shared`); image chỉ gồm cây đó và `.next/static`.

Copy file khai báo trước code giúp Docker dùng lại lớp đã cài thư viện khi chỉ có code thay đổi.
`.dockerignore` loại `node_modules` của máy dev: image chạy Alpine (musl), máy dev thì không.

Dung lượng trên đĩa: api 1,26 GB → 391 MB (trong đó `node_modules` 111 MB), web 1,72 GB → 335 MB.
Image `migrate` vẫn lớn (~1,3 GB) nhưng chỉ chạy một lần trước api. Cả hai image chạy thật đều dùng
user không đặc quyền `node`. Có thể đổi cổng trên máy bằng `WEB_PORT`, `API_PORT`, `DB_PORT`.

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

## Database cho test

`npm test` không bao giờ đụng tới database dev. Bước chuẩn bị chung của Vitest
(`apps/api/test/setup/global-setup.ts`) xoá và tạo lại `tc_test` ngay cạnh nó, chạy mọi migration và
seed, rồi cả bộ test chạy trên database đó. Nhờ vậy test được phép ghi sổ cái (vốn không xoá được),
và lần chạy nào cũng bắt đầu từ cùng một trạng thái. Để an toàn, bước chuẩn bị từ chối tạo lại bất kỳ
database nào có tên không kết thúc bằng `_test`. CI dùng đúng cơ chế này trên Postgres của nó.
