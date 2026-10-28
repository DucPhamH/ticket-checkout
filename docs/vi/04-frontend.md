# Frontend (apps/web)

[English](../04-frontend.md)

Next.js 16 App Router, Tailwind v4, next-intl. Cấu trúc theo
[bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
và cách "chia theo tính năng" trong
[tài liệu Next.js](https://nextjs.org/docs/app/getting-started/project-structure).

```
app/[locale]/...           route; trang lấy dữ liệu và ghép các tính năng
app/[locale]/_components/  phần cấp app, ghép nhiều tính năng (SiteHeader)
components/ui/             khối nền: Button, Card, Badge, Money, QuantityStepper...
components/layout/         Container, thanh điều hướng, nút đổi ngôn ngữ
components/pricing/        PriceBreakdown (checkout và orders cùng dùng)
constants/                 hằng số toàn app (route, URL api, cookie phiên, màu trạng thái sự kiện)
lib/                       cn(), định dạng, api-client, session
hooks/                     hook dùng chung phía client (useLoadMore cho danh sách phân trang cursor)
features/<tính năng>/
  components/              giao diện riêng của tính năng
  api.ts                   lấy dữ liệu, chỉ chạy ở server
  actions.ts               server action (thay đổi dữ liệu)
  constants.ts
i18n/, messages/           ngôn ngữ và toàn bộ chữ hiển thị
```

Các tính năng: `events`, `checkout`, `orders`, `wallet`, `admin`, `users`.

## Quy tắc import

Phụ thuộc đi một chiều: **dùng chung -> tính năng -> app**.

- `components/`, `lib/`, `constants/` không bao giờ import từ `features/` hay `app/`.
- Tính năng không import tính năng khác. Thứ gì hai tính năng cùng cần thì chuyển lên phần dùng
  chung; trang nào cần hai tính năng thì trang đó tự ghép (trang ví đặt `orders/OrderList` cạnh
  `wallet/BalanceCards`).
- Không dùng file `index.ts` gom export; import thẳng file cần dùng.

Luật `import/no-restricted-paths` trong `eslint.config.mjs` kiểm tra điều này: vi phạm thì
`npm run lint` báo lỗi kèm gợi ý nên đặt code ở đâu.

## Lấy dữ liệu

Trang là Server Component. Trang gọi `features/*/api.ts` (đánh dấu `server-only`), file này gọi
api qua mạng nội bộ của Docker thông qua `lib/api-client.ts`. Trình duyệt không bao giờ thấy URL
của api.

`apiRequest()` gửi `X-User-Id` lấy từ cookie phiên (`lib/session.ts`) ở mọi lần gọi, và biến
response lỗi thành `ApiError` mang `code` của api. Phiên nằm ở phần dùng chung chứ không nằm trong
tính năng `users`, vì tính năng nào gọi api cũng cần nó. Trang được render
theo từng request (ký hiệu `ƒ` khi build), nên tin đăng và trạng thái đơn luôn mới.

Thay đổi dữ liệu (tạo đơn, đổi người dùng, thao tác quản trị) là Server Action trong
`features/*/actions.ts`.

Trang kết quả đơn tự gọi `router.refresh()` vài giây một lần khi đơn còn `PENDING`; mỗi lần như
vậy server đọc lại đơn.

## Đa ngôn ngữ

`/vi/...` và `/en/...`; `/` chuyển về `/vi` (`proxy.ts`). Mọi chữ hiển thị nằm trong
`messages/vi.json` và `messages/en.json`, hai file có bộ khoá giống hệt nhau. Tiền và ngày giờ
định dạng bằng `Intl` theo múi giờ `Asia/Ho_Chi_Minh`.

## Điện thoại

Bố cục thiết kế cho điện thoại trước. Trên điện thoại, điều hướng là thanh tab dưới đáy, còn
phần thanh toán là một tấm trượt nằm ngay trên thanh đó; từ cỡ `md` trở lên, điều hướng lên
header và phần thanh toán thành thẻ dính bên phải. Nút đổi người dùng dùng `<select>` gốc để
điện thoại hiện bảng chọn của hệ điều hành.
