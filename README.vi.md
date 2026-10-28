# Thanh toán vé có escrow

[English](README.md)

Một lát cắt mỏng của sàn mua bán lại vé sự kiện. Người mua chọn một tin đăng và thanh toán qua
**VNPay sandbox**; tiền được **giữ hộ (escrow)** cho tới khi admin đánh dấu sự kiện đã diễn ra, lúc
đó mới chuyển sang khả dụng cho người bán. Mọi lần tiền di chuyển là một giao dịch **sổ cái kép
(double-entry)**, và mọi số dư trên màn hình đều được tính ra từ sổ cái.

TypeScript toàn bộ: Next.js 16 (giao diện render ở server), Express 5 (api), PostgreSQL 16,
Prisma 7, npm workspaces, Docker Compose. Giao diện có tiếng Việt và tiếng Anh, dùng tốt trên
điện thoại.

## Chạy

Chỉ cần Docker.

```bash
cp .env.example .env
# Điền VNP_TMN_CODE và VNP_HASH_SECRET: thông tin VNPay sandbox, được gửi riêng.
# Thiếu chúng thì api từ chối khởi động (báo lỗi ngay).
docker compose up --build
```

| Gì           | Ở đâu                               |
| ------------ | ----------------------------------- |
| Web          | http://localhost:3000               |
| Api health   | http://localhost:4000/health        |
| Tài liệu api | http://localhost:4000/docs          |
| Postgres     | `localhost:5432`, user/pass/db `tc` |

`docker compose up` khởi động Postgres, chạy job `migrate` một lần (migration + dữ liệu mẫu, chạy
lại an toàn), rồi tới api, rồi web. Cổng bị chiếm? Đặt `WEB_PORT`, `API_PORT`, `DB_PORT` (và
`WEB_PUBLIC_URL` / `API_PUBLIC_URL` tương ứng) trong `.env`.

### Dùng thử

Không có đăng nhập: chọn mình là ai ở ô đổi người dùng trên thanh đầu trang.

| Người dùng   | Vai trò                                          |
| ------------ | ------------------------------------------------ |
| Alice Nguyen | người bán                                        |
| Bob Tran     | người bán                                        |
| Chi Le       | người mua (mặc định)                             |
| Admin        | đánh dấu đã diễn ra hoặc huỷ sự kiện, xem sổ cái |

1. Với tư cách **Chi**, mở một sự kiện, chọn tin đăng và số lượng, rồi thanh toán. Trình duyệt
   chuyển sang VNPay sandbox; trả bằng thẻ test được cấp khi đăng ký sandbox (ngân hàng NCB).
2. Quay về trang đơn hàng, đơn chuyển sang **Đã thanh toán**. Trong **Ví của tôi**, Chi thấy đơn;
   với tư cách **Alice** (người bán), tiền hiện ở mục **Đang giữ (escrow)**.
3. Với tư cách **Admin**, vào **Quản trị**, bấm **Đánh dấu đã diễn ra**: escrow được giải ngân.
   Tiền của Alice chuyển sang **Khả dụng**; bảng cân đối thử vẫn có tổng bằng 0.
4. Hoặc **Huỷ sự kiện**: mọi đơn đã thanh toán được hoàn tiền qua API hoàn tiền của VNPay.
5. Ai cũng bán được: **Bán vé** ở trang sự kiện, **Gỡ tin** trong Ví của tôi.

### Nhận kết quả thanh toán khi không có tunnel

VNPay báo kết quả hai lần: trình duyệt quay về **Return URL**, và VNPay gọi **IPN** từ server tới
server. IPN là nguồn sự thật, nhưng VNPay không gọi được tới `localhost`. Vì vậy khi trình duyệt
quay về mà chưa có IPN, api tự hỏi VNPay (**querydr**, một truy vấn server-to-server có chữ ký) và
áp dụng câu trả lời y như một IPN. Nếu VNPay còn đang xử lý, trang đơn hàng hỏi lại, tối đa 10 giây
một lần, cho tới khi có kết quả. **Người chấm không cần tunnel.**

Muốn nhận IPN thật, file compose có sẵn service ngrok (cần `NGROK_AUTHTOKEN` và `NGROK_DOMAIN`
cố định):

```bash
docker compose --profile tunnel up -d
# Đăng ký https://<NGROK_DOMAIN>/payments/vnpay/ipn trong trang quản trị merchant của VNPay sandbox.
```

Chi tiết: [docs/vi/running.md](docs/vi/running.md).

## Phí và tiền

- Người mua trả **giá vé + 10%**; người bán nhận **giá vé − 5%**; sàn giữ 15%. Phí tính một lần
  trên tạm tính của đơn, theo basis point, làm tròn nửa lên, và phần của sàn là phần còn lại, nên
  các phần luôn cộng đúng bằng số tiền người mua trả.
- Tiền là **số nguyên VND** từ đầu tới cuối (`BIGINT` trong Postgres), không bao giờ dùng số thực.
  Phép ×100 của VNPay chỉ áp dụng ở chỗ giao tiếp với cổng thanh toán.
- Số tiền được chốt trên đơn lúc tạo; người mua trả đúng con số họ đã thấy.

## Escrow và sổ cái

| Việc                            | Nợ (debit)                            | Có (credit)                                   |
| ------------------------------- | ------------------------------------- | --------------------------------------------- |
| Thanh toán thành công (IPN)     | tiền ở cổng thanh toán                | người bán **đang giữ**, phí sàn chưa ghi nhận |
| Sự kiện đã diễn ra              | người bán đang giữ, phí chưa ghi nhận | người bán **khả dụng**, doanh thu phí         |
| Sự kiện bị huỷ                  | người bán đang giữ, phí chưa ghi nhận | nợ hoàn tiền người mua                        |
| Trả tiền quá muộn (không có vé) | tiền ở cổng thanh toán                | nợ hoàn tiền người mua                        |
| Đã hoàn tiền (VNPay)            | nợ hoàn tiền người mua                | tiền ở cổng thanh toán                        |

- Không lưu số dư ở đâu cả: đang giữ, khả dụng và đang hoàn đều là tổng các dòng sổ cái, tính lại
  mỗi lần gọi. Trang quản trị hiện bảng cân đối thử, tổng luôn phải bằng 0.
- Database cũng ép buộc điều đó: một trigger hoãn tới lúc commit từ chối mọi giao dịch có tổng khác
  0, bảng sổ cái chỉ được thêm, và mỗi bút toán có khoá idempotency (`capture:order:42`), nên IPN
  gửi lại không bao giờ ghi hai lần.

Thêm: [docs/vi/06-ledger.md](docs/vi/06-ledger.md).

## Đúng khi chạy đồng thời

- **Không bán quá số vé.** Giữ vé là một câu `UPDATE … WHERE quantity_available >= n` có điều kiện.
- **Giữ vé hết hạn** sau 15 phút (cũng là hạn thanh toán gửi cho VNPay). Mỗi 60 giây một lượt quét
  dùng `FOR UPDATE SKIP LOCKED` theo lô; đơn quá hạn cũng được chuyển hết hạn ngay khi được đọc.
- **IPN, querydr và lượt quét hết hạn** áp dụng kết quả ở cùng một chỗ, khoá đơn rồi khoá payment,
  nên mỗi khoản thanh toán chỉ được ghi nhận một lần dù cái nào tới trước. Tiền tới sau khi vé đã
  bán cho người khác, hoặc sau khi sự kiện đã kết thúc, được **hoàn lại, không bao giờ bị bỏ qua**.
- **Giải ngân hoặc huỷ sự kiện** khoá độc quyền dòng sự kiện; mua vé và ghi nhận thanh toán giữ
  khoá chia sẻ, nên không có tiền nào lọt vào escrow sau khi sự kiện đã được giải ngân.
- **Hoàn tiền** được gửi khi dòng hoàn tiền đang bị khoá, nên bấm gửi lại hai lần cùng lúc chỉ
  hoàn một lần.

Mỗi điểm trên có test chạy hai phía cùng lúc, và đã được kiểm chứng bằng cách bỏ khoá rồi xem test
thất bại.

## Vì sao chọn VNPay

Dùng VND, là cổng thanh toán phổ biến nhất ở Việt Nam, đăng ký sandbox ngay, và có đủ những gì cần:
chuyển hướng trình duyệt, IPN server-to-server, API truy vấn để đối soát và API hoàn tiền. Phần tích
hợp tự viết (phần ký khoảng 40 dòng) thay vì dùng thư viện cộng đồng, để mọi byte gửi tới cổng
thanh toán đều giải thích được và có test.

## Quyết định

Những lựa chọn đề bài để ngỏ, kèm lý do, nằm trong [docs/vi/decisions.md](docs/vi/decisions.md).
Những điểm chính:

- Api Express riêng: logic tiền nằm ở một service; web chỉ gọi api **từ phía server** (không CORS,
  trình duyệt không thấy api).
- Không xác thực, như đề cho phép: người dùng hiện tại nằm trong cookie, gửi sang api qua `X-User-Id`.
- Phí sàn được giữ ở trạng thái _chưa ghi nhận_ cho tới khi sự kiện diễn ra, vì trước đó giao dịch
  vẫn có thể bị đảo ngược.
- Quy tắc của database được viết lại bằng SQL (CHECK, trigger sổ cái) làm lớp bảo vệ cuối cùng.
- Phạm vi thêm ngoài đề: huỷ sự kiện kèm hoàn tiền, và người bán tự đăng tin.

Tài liệu kiến trúc của codebase: [docs/vi/](docs/vi/README.md).

## Test

```bash
npm install
npm run build -w @tc/shared
npm run dev:db        # Postgres trong Docker
npm test              # 193 test của api
npm run lint && npm run typecheck
```

Test api chạy trên database riêng (`tc_test`), được dựng lại từ migration mỗi lần chạy, và không bao
giờ gọi ra mạng: câu trả lời của VNPay được giả lập và ký bằng secret test. Test bao phủ phép tính
phí, chữ ký (so với giá trị tính độc lập bằng `openssl`), mọi mã trả lời IPN, thanh toán trễ và
trùng lặp, các bất biến của sổ cái, phân trang và các tình huống đồng thời ở trên.

Phát triển (tự tải lại, xem log, giả lập IPN): [docs/vi/running.md](docs/vi/running.md).

## Chưa sẵn sàng cho production

Những gì cần đổi trước khi dùng tiền thật:

- **Xác thực.** Ai cũng có thể làm người khác, theo thiết kế của đề. Thao tác admin chỉ được chặn
  bằng vai trò của người dùng đang chọn.
- **Lạm dụng giữ vé.** Chưa giới hạn số đơn chưa trả của mỗi người, chưa giới hạn tần suất: một
  người có thể giữ hết vé, mỗi lần 15 phút.
- **Giải ngân quá sớm.** Admin đánh dấu "đã diễn ra" được cả trước giờ bắt đầu (để demo được với các
  sự kiện mẫu ở tương lai). Production chỉ nên cho phép sau sự kiện, cộng thêm thời gian khiếu nại.
- **Chưa có đối soát tự động.** Nếu IPN không bao giờ tới _và_ người mua đóng tab trước khi quay về,
  đơn đã trả tiền sẽ bị chuyển hết hạn. Tiền không mất (IPN tới muộn hoặc
  `npm run vnpay:reconcile -w @tc/api -- <orderId>` sẽ lấy lại vé hoặc hoàn tiền), nhưng không có gì
  tự phát hiện. Production cần một job định kỳ gọi querydr cho các khoản chưa có kết quả.
- **Sự kiện lớn.** Giải ngân hoặc huỷ sự kiện xử lý mọi đơn trong một transaction, và huỷ thì gửi
  từng khoản hoàn tiền ngay trong request. Sự kiện lớn cần chia lô và hàng đợi job.
- **Hoàn tiền với sandbox thật chưa được kiểm chứng.** Lệnh hoàn tiền viết theo tài liệu VNPay và có
  test với câu trả lời giả lập có chữ ký; trong lúc hoàn thiện, API server-to-server của sandbox
  (querydr và refund) trả `99 Unexpected error` cho mọi yêu cầu, kể cả những truy vấn đã chạy được
  trước đó cùng ngày. Khoản hoàn nào thất bại vẫn nằm trong danh sách để admin gửi lại.
- **Vận hành.** Secret lấy từ `.env` (production nên dùng secret manager), log là JSON ra stdout
  chưa có nơi thu thập, chưa có giám sát hay cảnh báo, và tunnel nhận IPN dùng gói miễn phí của ngrok.

## Cách dùng AI

Làm cùng một trợ lý lập trình AI (Claude Code) theo kiểu lập trình cặp. Tôi đặt phạm vi và kế
hoạch, mỗi tính năng một commit, và xem lại, chạy thử từng bước; trợ lý viết phần lớn code, test và
tài liệu, đồng thời giải thích từng khái niệm trong lúc làm. Kết quả được kiểm tra bằng bộ test,
bằng cách cố ý phá từng cơ chế bảo vệ để chắc chắn có test thất bại, và bằng các lần thanh toán
đầu-cuối với VNPay sandbox thật (gồm cả một IPN thật đi qua tunnel). Đặc tả VNPay được đọc từ tài
liệu chính thức, và chỗ tài liệu sai (thiếu một dấu `|` trong chuỗi ký của câu trả lời querydr)
được xác nhận lại với sandbox thật.

## Thời gian

Khoảng _N_ giờ trong _N_ ngày.
