# Chạy app và xem log

[English](../running.md)

## Hai cách chạy

|              | Toàn bộ trong Docker                          | Chế độ dev (tự tải lại)                                                                                              |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Bật          | `docker compose up -d --build`                | `npm run dev:db`, rồi `npm run dev` (shared + api + web trong một terminal, gắn nhãn `[shared]` / `[api]` / `[web]`) |
| Khi sửa code | build lại: `docker compose up -d --build api` | tự nhận thay đổi                                                                                                     |
| Xem log      | `docker compose logs -f api`                  | in ngay trong từng terminal                                                                                          |
| Dùng khi     | chạy giống reviewer; kiểm tra bản build thật  | phát triển hằng ngày                                                                                                 |

Cả hai cách đều dùng cổng 4000 cho api và 3000 cho web, nên phải dừng service trong Docker trước
khi chạy chính nó ở chế độ dev: `docker compose stop api`.

## Chế độ dev từng bước

```bash
docker compose stop api web   # nhường cổng 4000 và 3000 nếu bản Docker đang chạy
npm run dev:db                # Postgres trong Docker (thứ duy nhất chế độ dev cần từ Docker)
npm run dev                   # shared (tự build lại khi lưu), api ở :4000, web ở :3000; lưu file là tự tải lại
# Ctrl+C để dừng cả hai
```

Muốn mỗi service một terminal riêng thì chạy `npm run dev:api` và `npm run dev:web`.

`npm run dev` cũng tự biên dịch lại `packages/shared` khi lưu file. Các app import bản đã biên dịch
(`dist/`), không phải `src/`, nên nếu chỉ chạy `dev:api` / `dev:web` thì sửa shared sẽ không có tác
dụng cho tới khi chạy `npm run build -w @tc/shared`. Sửa `schema.prisma` thì chạy
`npm run db:migrate -w @tc/api`.

`console.log` hiện ở đâu: code chạy ở server (api, Server Component) in ra terminal; code trong
component có `'use client'` in ra **Console của DevTools trên trình duyệt**.

## Lệnh Docker

```bash
docker compose ps                      # service nào đang chạy, có khoẻ không
docker compose logs -f api             # theo dõi log api liên tục (Ctrl+C để thôi theo dõi)
docker compose logs --tail 50 api      # 50 dòng cuối
docker compose logs --since 10m web    # log 10 phút gần nhất
docker compose logs -f                 # log mọi service, xen kẽ nhau
docker compose restart api             # khởi động lại, không build
docker compose up -d --build api       # build lại sau khi sửa code
docker compose down                    # dừng tất cả (dữ liệu vẫn còn trong volume của db)
```

## Log của api

Mỗi request một dòng, do `pino-http` ghi (`apps/api/src/middlewares/request-logger.ts`):

```
[04:18:09.476] INFO: GET /events 200 63ms {"req":{"id":"ac47aa08-..."}}
[04:18:09.488] INFO: GET /me 200 6ms {"req":{"id":"5eec7265-...","userId":"1"}}
[04:18:09.504] WARN: GET /events/999 404 9ms {"req":{"id":"946c3bbe-..."}}
[04:18:09.519] WARN: GET /me 401 1ms {"req":{"id":"2709732a-..."}}
```

- Mức log theo kết quả: `INFO` cho 2xx/3xx, `WARN` cho 4xx, `ERROR` cho 5xx. Lỗi bất ngờ có in
  kèm stack trace.
- Mỗi request có một mã, được trả về trong header `X-Request-Id` của response. Tìm mã đó trong log
  để ra đúng request cần xem.
- `/health` không được ghi log, vì Docker gọi nó vài giây một lần.
- Khi phát triển log là dòng chữ dễ đọc, khi `NODE_ENV=production` là JSON, khi chạy test thì tắt.

Cấu hình (trong `.env`):

| Biến        | Mặc định | Tác dụng                                                        |
| ----------- | -------- | --------------------------------------------------------------- |
| `LOG_LEVEL` | `info`   | `debug` để xem nhiều hơn, `warn` để xem ít hơn                  |
| `LOG_SQL`   | `false`  | `true` thì in mọi câu SQL Prisma chạy, kèm tham số và thời gian |

```bash
LOG_SQL=true npm run dev:api                       # chế độ dev
LOG_SQL=true docker compose up -d api              # Docker (đọc biến từ shell hoặc .env)
```

Ví dụ với `LOG_SQL=true`, gọi `GET /events/1` cho ra ba câu SQL (sự kiện, tin đăng, người bán)
trước dòng log của request:

```
INFO: SQL SELECT ... FROM "events" WHERE ("events"."id" = $1 ...) {"params":"[1,...]","durationMs":3.5}
INFO: SQL SELECT ... FROM "listings" WHERE (...) ORDER BY "listings"."unit_price" ASC ... {"durationMs":6.1}
INFO: SQL SELECT "users"."id", "users"."name" FROM "users" WHERE "users"."id" IN ($1,$2,$3) ... {"durationMs":1.4}
INFO: GET /events/1 200 44ms
```

## Log của web

Next.js in từng lần tải trang trong terminal của nó, hoặc trong `docker compose logs -f web`:

```
GET /vi/events/1 200 in 120ms
```

Trang gọi api **ở phía server**, nên các lần gọi api đó nằm trong log của api, **không** hiện ở
tab Network trong DevTools của trình duyệt. Trình duyệt chỉ thấy các request tới web.

## Database

```bash
npm run db:studio -w @tc/api                       # xem bảng trên trình duyệt
docker compose exec db psql -U tc -d tc            # gõ SQL trực tiếp (\q để thoát)
docker compose logs -f db                          # log của server Postgres
```

## Giả lập IPN của VNPay

Trong lúc VNPay chưa gọi được vào máy này (chưa có tunnel), dùng script đóng vai VNPay:

```bash
npm run vnpay:simulate-ipn -w @tc/api -- 635        # thành công: đơn 635 thành PAID
npm run vnpay:simulate-ipn -w @tc/api -- 636 24     # khách huỷ: FAILED, trả vé
```

Script ký IPN bằng `VNP_HASH_SECRET` thật rồi gửi tới `API_PUBLIC_URL`, nên api phải đang chạy.

## Đối soát một thanh toán bằng tay

```bash
npm run vnpay:reconcile -w @tc/api -- 637    # hỏi VNPay (querydr) rồi áp dụng câu trả lời
```

## Đường hầm cho IPN của VNPay

VNPay phải gọi được api qua HTTPS. ngrok cấp địa chỉ cố định trong `NGROK_DOMAIN` (`NGROK_AUTHTOKEN` và
`NGROK_DOMAIN` nằm trong `.env`):

```bash
npm run tunnel                              # api chạy chế độ dev trên máy
docker compose --profile tunnel up -d       # api chạy trong Docker
curl https://$NGROK_DOMAIN/health           # gọi được từ internet
```

IPN URL cần đăng ký với VNPay là `https://<NGROK_DOMAIN>/payments/vnpay/ipn`. Mọi request đi qua đường hầm
được liệt kê ở http://localhost:4040.

Gửi một IPN có chữ ký qua đường hầm, đúng như VNPay sẽ gửi:

```bash
IPN_BASE_URL=https://$NGROK_DOMAIN npm run vnpay:simulate-ipn -w @tc/api -- <mã đơn>
```

Gói miễn phí của ngrok hiện một trang cảnh báo với request có User-Agent giống trình duyệt; các chương
trình khác đi thẳng. Nếu IPN của VNPay có lúc bị chặn như vậy, VNPay sẽ gọi lại, và đối soát `querydr`
vẫn xác nhận thanh toán khi khách quay về.
