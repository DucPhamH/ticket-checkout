# Chạy app và xem log

[English](../running.md)

## Hai cách chạy

|              | Toàn bộ trong Docker                          | Chế độ dev (tự tải lại)                                                                        |
| ------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Bật          | `docker compose up -d --build`                | `npm run dev:db`, rồi `npm run dev` (api + web trong một terminal, gắn nhãn `[api]` / `[web]`) |
| Khi sửa code | build lại: `docker compose up -d --build api` | tự nhận thay đổi                                                                               |
| Xem log      | `docker compose logs -f api`                  | in ngay trong từng terminal                                                                    |
| Dùng khi     | chạy giống reviewer; kiểm tra bản build thật  | phát triển hằng ngày                                                                           |

Cả hai cách đều dùng cổng 4000 cho api và 3000 cho web, nên phải dừng service trong Docker trước
khi chạy chính nó ở chế độ dev: `docker compose stop api`.

## Chế độ dev từng bước

```bash
docker compose stop api web   # nhường cổng 4000 và 3000 nếu bản Docker đang chạy
npm run dev:db                # Postgres trong Docker (thứ duy nhất chế độ dev cần từ Docker)
npm run dev                   # api ở :4000 và web ở :3000, lưu file là tự tải lại
# Ctrl+C để dừng cả hai
```

Muốn mỗi service một terminal riêng thì chạy `npm run dev:api` và `npm run dev:web`.

Sửa `packages/shared` thì build lại nó (`npm run build -w @tc/shared`); sửa `schema.prisma` thì chạy
`npm run db:migrate -w @tc/api`.

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
