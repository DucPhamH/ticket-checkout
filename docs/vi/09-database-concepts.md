# Khái niệm database dùng trong project

[Hướng dẫn đọc từng bảng](08-database-guide.md) · [Tóm tắt kỹ thuật](07-database.md)

Tài liệu này giải thích từ đầu những khái niệm dễ gây khó hiểu: ràng buộc, index, transaction,
khoá dòng, trigger, PL/pgSQL, view, migration. Mỗi khái niệm có ví dụ lấy từ chính project, và
những đoạn SQL viết tay trong migration được giải thích từng dòng.

Các kết quả minh hoạ (`EXPLAIN`, hai phiên mua vé song song) được chạy thật trên database của
project.

## Mục lục

1. [Ràng buộc (constraint)](#1-ràng-buộc-constraint)
2. [Index](#2-index)
3. [Transaction](#3-transaction)
4. [Race condition và khoá dòng (row lock)](#4-race-condition-và-khoá-dòng-row-lock)
5. [Trigger](#5-trigger)
6. [PL/pgSQL](#6-plpgsql)
7. [View](#7-view)
8. [WITH (CTE): gộp nhiều bước vào một câu SQL](#8-with-cte--gộp-nhiều-bước-vào-một-câu-sql)
9. [Migration](#9-migration)
10. [Kiểu dữ liệu đáng chú ý](#10-kiểu-dữ-liệu-đáng-chú-ý)
11. [Bảng tóm tắt](#11-bảng-tóm-tắt)

---

## 1. Ràng buộc (constraint)

**Ràng buộc là luật mà database tự kiểm tra mỗi khi ghi dữ liệu.** Vi phạm thì lệnh ghi bị từ
chối, dữ liệu sai không bao giờ được lưu.

Vì sao không chỉ kiểm tra trong code? Vì code có thể có bug, có thể có người sửa tay bằng SQL,
có thể sau này có service thứ hai ghi vào cùng database. Ràng buộc là **lớp bảo vệ cuối cùng**,
luôn chạy dù dữ liệu đến từ đâu.

| Loại          | Ý nghĩa                          | Ví dụ trong project                                       |
| ------------- | -------------------------------- | --------------------------------------------------------- |
| `NOT NULL`    | Cột bắt buộc có giá trị          | `orders.total` không được trống                           |
| `PRIMARY KEY` | Định danh duy nhất của dòng      | `orders.id`                                               |
| `FOREIGN KEY` | Giá trị phải tồn tại ở bảng khác | `orders.buyer_id` phải là một `users.id` có thật          |
| `UNIQUE`      | Không được trùng giữa các dòng   | `payments.txn_ref`, `ledger_transactions.idempotency_key` |
| `CHECK`       | Biểu thức tuỳ ý phải đúng        | `quantity_available BETWEEN 0 AND quantity_total`         |

### Khoá ngoại và `ON DELETE RESTRICT`

```sql
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey"
  FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
```

- `FOREIGN KEY ("buyer_id") REFERENCES "users"("id")`: mỗi `orders.buyer_id` phải trỏ tới một
  người dùng có thật. Không tạo được đơn cho người dùng số 999 nếu người đó không tồn tại.
- `ON DELETE RESTRICT`: không xoá được người dùng nếu họ còn đơn hàng. Các lựa chọn khác là
  `CASCADE` (xoá người dùng thì xoá luôn đơn của họ) hay `SET NULL`. Với dữ liệu liên quan tới
  tiền, xoá dây chuyền là rất nguy hiểm, nên project dùng `RESTRICT` ở mọi nơi.

### `CHECK` – giải thích các ràng buộc viết tay

```sql
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_quantity_available_range"
  CHECK ("quantity_available" BETWEEN 0 AND "quantity_total");
```

Số vé còn lại không bao giờ âm (bán quá số vé) và không bao giờ vượt tổng (trả vé hai lần). Kể
cả khi code giữ vé có bug, database vẫn chặn.

```sql
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_matches" CHECK ("total" = "subtotal" + "buyer_fee");
```

Tổng tiền phải đúng bằng tạm tính cộng phí. Không lưu được một đơn "tính nhầm".

```sql
ALTER TABLE "events"
  ADD CONSTRAINT "events_completed_at_matches_status"
  CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));
```

So sánh hai giá trị đúng/sai với nhau. Ràng buộc chỉ đúng khi cả hai vế cùng đúng (đã hoàn tất
và có thời điểm) hoặc cùng sai (chưa hoàn tất và không có thời điểm).

---

## 2. Index

### Index là gì

Hình dung bảng `orders` là một cuốn sổ ghi đơn theo thứ tự thời gian. Muốn tìm "các đơn đang chờ
đã quá hạn", không có index thì phải **lật từng trang** (gọi là _sequential scan_). Có 10 đơn thì
nhanh, có 10 triệu đơn thì rất chậm.

**Index giống mục lục cuối sách:** một danh sách đã **sắp xếp sẵn** theo một hoặc vài cột, mỗi
mục chỉ tới trang chứa dòng đó. Postgres dùng cấu trúc **B-tree** (cây cân bằng), tìm trong một
triệu dòng chỉ mất khoảng 20 bước so sánh.

### Cái giá phải trả

- **Ghi chậm hơn một chút:** mỗi lần thêm/sửa dòng, database cập nhật cả index.
- **Tốn thêm dung lượng.**

Vì vậy **không đánh index mọi cột**, chỉ đánh những cột thật sự dùng để tìm kiếm, nối bảng
(`JOIN`) hoặc sắp xếp.

### Index nhiều cột: thứ tự cột quan trọng

Index `(status, expires_at)` được sắp xếp **theo `status` trước, trong cùng `status` thì theo
`expires_at`**, giống danh bạ sắp theo họ rồi mới tới tên:

```
(EXPIRED, 10:00) (EXPIRED, 10:20) (PAID, 09:00) (PAID, 11:30) (PENDING, 10:05) (PENDING, 10:40) ...
```

- Tìm `status = 'PENDING' AND expires_at < now()`: nhảy thẳng tới khúc `PENDING`, đọc phần đầu
  khúc đó. **Rất hiệu quả.**
- Tìm chỉ `status = 'PENDING'`: vẫn dùng được (giống tìm theo họ trong danh bạ).
- Tìm chỉ `expires_at < now()`: **không dùng hiệu quả được**, vì `expires_at` nằm rải rác trong
  từng khúc `status` (giống tìm theo tên mà không biết họ).

Quy tắc: index nhiều cột phục vụ các truy vấn lọc theo **cột đầu tiên**, hoặc cột đầu và cột thứ
hai, và cứ thế (gọi là _leftmost prefix_).

### Xem database có dùng index không: `EXPLAIN`

`EXPLAIN` cho biết database **định chạy truy vấn thế nào**. Kết quả thật trên project:

```
EXPLAIN SELECT * FROM orders WHERE status = 'PENDING' AND expires_at < now();

 Index Scan using orders_status_expires_at_idx on orders
   Index Cond: ((status = 'PENDING') AND (expires_at < now()))
```

Đọc là: dùng index `orders_status_expires_at_idx`, áp **cả hai điều kiện** ngay trên index.

So với truy vấn chỉ lọc theo cột thứ hai:

```
EXPLAIN SELECT * FROM orders WHERE expires_at < now();

 Bitmap Heap Scan on orders
   ->  Bitmap Index Scan on orders_status_expires_at_idx
         Index Cond: (expires_at < now())
```

Vẫn chạm vào index nhưng phải **quét toàn bộ index** rồi lọc, đúng như phân tích ở trên. (Với
bảng rất nhỏ, Postgres có khi chọn đọc thẳng cả bảng vì như vậy còn nhanh hơn; đó là chuyện bình
thường.)

### Toàn bộ index trong project

Postgres **tự tạo index** cho khoá chính (`*_pkey`) và cột `UNIQUE` (`*_key`), vì cần nó để kiểm
tra trùng. **Khoá ngoại thì không được tự tạo index**, nên project tự thêm.

| Bảng                    | Index                                                 | Cột                                   | Để làm gì                                                      |
| ----------------------- | ----------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| mọi bảng                | `*_pkey`                                              | `id`                                  | Tìm theo khoá chính (tự tạo)                                   |
| `events`                | `events_status_starts_at_idx`                         | `status, starts_at`                   | Danh sách sự kiện đang mở bán, xếp theo ngày                   |
| `listings`              | `listings_event_id_status_idx`                        | `event_id, status`                    | Trang sự kiện: tin đăng `ACTIVE` của một sự kiện               |
| `listings`              | `listings_seller_id_idx`                              | `seller_id`                           | "Tin đăng của tôi"; khoá ngoại                                 |
| `orders`                | `orders_buyer_id_created_at_idx`                      | `buyer_id, created_at DESC`           | "Đơn của tôi", mới nhất trước – không cần sắp xếp lại          |
| `orders`                | `orders_listing_id_idx`                               | `listing_id`                          | Đơn của một tin đăng (giải ngân, huỷ); khoá ngoại              |
| `orders`                | `orders_status_expires_at_idx`                        | `status, expires_at`                  | Quét đơn `PENDING` quá hạn để trả vé                           |
| `payments`              | `payments_order_id_key` (unique)                      | `order_id`                            | Mỗi đơn tối đa một payment; tìm payment của một đơn            |
| `payments`              | `payments_txn_ref_key` (unique)                       | `txn_ref`                             | IPN gửi về `vnp_TxnRef` → tìm payment; không trùng mã          |
| `payment_notifications` | `payment_notifications_payment_id_received_at_idx`    | `payment_id, received_at`             | Lịch sử thông báo của một payment theo thời gian               |
| `refunds`               | `refunds_order_id_key` (unique)                       | `order_id`                            | Mỗi đơn tối đa một lần hoàn                                    |
| `refunds`               | `refunds_payment_id_idx`                              | `payment_id`                          | Khoá ngoại                                                     |
| `refunds`               | `refunds_status_idx`                                  | `status`                              | Danh sách hoàn tiền đang chờ / lỗi cần thử lại                 |
| `accounts`              | `accounts_code_key` (unique)                          | `code`                                | Tìm tài khoản theo mã (`seller:1:pending`); không trùng mã     |
| `accounts`              | `accounts_user_id_idx`                                | `user_id`                             | Các tài khoản của một người dùng (trang Ví); khoá ngoại        |
| `ledger_transactions`   | `ledger_transactions_idempotency_key_key` (unique)    | `idempotency_key`                     | **Chống ghi sổ hai lần**                                       |
| `ledger_transactions`   | `…_order_id_idx`, `…_event_id_idx`, `…_refund_id_idx` | `order_id` / `event_id` / `refund_id` | Bút toán của một đơn / sự kiện / lần hoàn; khoá ngoại          |
| `ledger_entries`        | `ledger_entries_account_id_idx`                       | `account_id`                          | **Tính số dư** một tài khoản = cộng các dòng của nó            |
| `ledger_entries`        | `ledger_entries_transaction_id_idx`                   | `transaction_id`                      | Các dòng của một giao dịch (trigger cân bằng dùng); khoá ngoại |

**Vì sao khoá ngoại cần index?** Hai lý do: (1) truy vấn `JOIN` theo khoá ngoại rất thường gặp;
(2) khi sửa/xoá dòng ở bảng cha, Postgres phải tìm dòng con tham chiếu tới nó, không có index thì
phải đọc cả bảng con.

---

## 3. Transaction

**Transaction là một nhóm lệnh được thực hiện "tất cả hoặc không gì cả".**

```sql
BEGIN;                                   -- bắt đầu
UPDATE listings SET quantity_available = quantity_available - 2 WHERE id = 1;
INSERT INTO orders (...) VALUES (...);
INSERT INTO payments (...) VALUES (...);
COMMIT;                                  -- lưu tất cả
-- hoặc ROLLBACK;                        -- huỷ tất cả
```

Nếu lệnh thứ ba lỗi (mất mạng, vi phạm ràng buộc), cả transaction bị huỷ: số vé **không** bị trừ,
đơn **không** được tạo. Không bao giờ có trạng thái "trừ vé rồi mà không có đơn".

Bốn tính chất của transaction, gọi tắt **ACID**:

| Chữ | Tên         | Ý nghĩa đời thường                                                    |
| --- | ----------- | --------------------------------------------------------------------- |
| A   | Atomicity   | Tất cả hoặc không gì cả                                               |
| C   | Consistency | Sau transaction, mọi ràng buộc vẫn đúng                               |
| I   | Isolation   | Các transaction chạy song song không thấy trạng thái dở dang của nhau |
| D   | Durability  | Đã `COMMIT` thì mất điện cũng không mất                               |

**Trong project:** khi IPN báo thanh toán thành công, ba việc chuyển đơn sang `PAID`, cập nhật
payment và ghi sổ cái nằm trong **một transaction**. Không thể có đơn `PAID` mà sổ cái thiếu bút
toán, hay ngược lại.

Trong code (Prisma):

```ts
await prisma.$transaction(async (tx) => {
  await tx.order.update(...);
  await tx.payment.update(...);
  await postTransaction(tx, ...); // ghi sổ cái
}); // lỗi ở bất kỳ dòng nào → toàn bộ bị huỷ
```

---

## 4. Race condition và khoá dòng (row lock)

### Vấn đề

**Race condition** (điều kiện tranh chấp) xảy ra khi hai thao tác chạy cùng lúc và kết quả phụ
thuộc vào việc ai nhanh hơn. Ví dụ kinh điển: còn **1 vé**, A và B cùng bấm mua.

### Cách sai: đọc trước, ghi sau

Code "ngây thơ": đọc số vé ra, kiểm tra trong code, rồi ghi lại.

```ts
const listing = await db.listing.findUnique(...);   // đọc: còn 1
if (listing.quantityAvailable >= 1) {
  await db.listing.update({ quantityAvailable: listing.quantityAvailable - 1 }); // ghi: 0
}
```

Kết quả thật khi chạy hai phiên song song trên project:

```
A đọc: còn 1 vé
B đọc: còn 1 vé             ← B đọc trước khi A kịp ghi
A ghi: còn 0 -> A mua thành công
B ghi: còn 0 -> B mua thành công
```

**Một vé, hai người mua.** Lỗi này gọi là _lost update_. Nó không xuất hiện khi bạn tự test một
mình, chỉ xuất hiện khi nhiều người dùng thật cùng lúc, nên rất khó phát hiện.

### Cách đúng: một lệnh `UPDATE` có điều kiện

Gộp "kiểm tra" và "ghi" vào **một lệnh duy nhất**:

```sql
UPDATE listings
SET quantity_available = quantity_available - 1
WHERE id = 1 AND quantity_available >= 1;
```

Khi `UPDATE` một dòng, Postgres **tự khoá dòng đó** cho tới khi transaction kết thúc. Transaction
khác muốn sửa cùng dòng phải **xếp hàng đợi**. Khi tới lượt, nó đọc lại giá trị **mới nhất** rồi
mới kiểm tra điều kiện `WHERE`.

Kết quả thật:

```
A 07.624: giữ được vé, dòng đang bị KHOÁ
B 07.936: gửi UPDATE, dòng đang bị A khoá nên phải ĐỢI...
A 09.126: COMMIT, nhả khoá
B 09.126: HẾT VÉ (0 dòng thoả điều kiện available >= 1)
```

B đợi từ giây 07.936 tới 09.126, đúng lúc A commit. Lúc đó số vé đã là 0, điều kiện
`quantity_available >= 1` sai, nên **0 dòng được cập nhật**. Code chỉ cần kiểm tra "có dòng nào
được cập nhật không" để biết mua được hay hết vé.

### Khoá dòng (row lock) là gì

- Là "biển báo đang sửa" Postgres gắn lên **một dòng** (không phải cả bảng).
- Ai đang giữ khoá thì người khác muốn **sửa** dòng đó phải đợi; người chỉ **đọc** thì không bị
  chặn (đọc thấy giá trị trước khi sửa).
- Khoá tự nhả khi transaction `COMMIT` hoặc `ROLLBACK`.
- Vì chỉ khoá một dòng, hai người mua **hai tin đăng khác nhau** không phải chờ nhau.

Ngoài cách tự khoá qua `UPDATE`, có thể khoá chủ động bằng `SELECT ... FOR UPDATE` (đọc và khoá
luôn, dùng khi cần đọc nhiều thứ rồi mới quyết định ghi gì). Project dùng `UPDATE` có điều kiện
vì đơn giản hơn và đủ dùng cho việc giữ vé.

**Lớp bảo vệ thứ hai:** kể cả code giữ vé có bug, ràng buộc `quantity_available BETWEEN 0 AND
quantity_total` vẫn khiến database từ chối số vé âm.

Bước C4 trong kế hoạch có một test chạy hai yêu cầu mua song song thật để chứng minh điều này.

---

## 5. Trigger

**Trigger là đoạn code database tự chạy khi có sự kiện xảy ra trên một bảng** (thêm, sửa, xoá),
giống "nếu… thì…" gắn vào bảng.

Các lựa chọn khi tạo trigger:

| Lựa chọn                                               | Ý nghĩa                                        |
| ------------------------------------------------------ | ---------------------------------------------- |
| `BEFORE` / `AFTER`                                     | Chạy trước hay sau khi thao tác được thực hiện |
| `INSERT` / `UPDATE` / `DELETE`                         | Sự kiện nào kích hoạt                          |
| `FOR EACH ROW`                                         | Chạy một lần cho mỗi dòng bị ảnh hưởng         |
| `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` | Hoãn tới lúc `COMMIT` mới chạy                 |

**Trigger mạnh nhưng nên dùng ít**, vì nó "vô hình" với người đọc code ứng dụng. Project chỉ dùng
trigger cho **các quy tắc bất khả xâm phạm của sổ cái**, những thứ mà sai là mất tiền.

Project có 4 trigger, tất cả trên hai bảng sổ cái:

| Trigger                           | Bảng                  | Khi nào                         | Mục đích                                |
| --------------------------------- | --------------------- | ------------------------------- | --------------------------------------- |
| `ledger_entries_balanced`         | `ledger_entries`      | sau `INSERT`, hoãn tới `COMMIT` | Giao dịch phải cân (tổng = 0)           |
| `ledger_transactions_balanced`    | `ledger_transactions` | sau `INSERT`, hoãn tới `COMMIT` | Giao dịch không có dòng nào cũng bị bắt |
| `ledger_entries_append_only`      | `ledger_entries`      | trước `UPDATE`/`DELETE`         | Cấm sửa, xoá                            |
| `ledger_transactions_append_only` | `ledger_transactions` | trước `UPDATE`/`DELETE`         | Cấm sửa, xoá                            |

### Trigger cân bằng – vì sao phải "hoãn tới COMMIT"?

Một giao dịch ba dòng được thêm **từng dòng một**:

```
INSERT +990.000   → tổng tạm thời = +990.000  (chưa cân!)
INSERT −855.000   → tổng tạm thời = +135.000  (chưa cân!)
INSERT −135.000   → tổng = 0                  (cân)
COMMIT
```

Nếu kiểm tra ngay sau mỗi dòng thì dòng đầu tiên đã bị từ chối, vì lúc đó chưa cân. Phải **đợi
thêm đủ các dòng** rồi mới kiểm tra. `DEFERRABLE INITIALLY DEFERRED` nghĩa là "hoãn việc kiểm
tra tới lúc `COMMIT`".

```sql
CREATE CONSTRAINT TRIGGER "ledger_entries_balanced"
  AFTER INSERT ON "ledger_entries"           -- sau mỗi lần thêm dòng bút toán
  DEFERRABLE INITIALLY DEFERRED              -- nhưng hoãn tới COMMIT mới chạy
  FOR EACH ROW EXECUTE FUNCTION "ledger_assert_balanced"();  -- gọi hàm kiểm tra
```

**Vì sao cần thêm trigger trên `ledger_transactions`?** Nếu code tạo một giao dịch mà **quên thêm
dòng nào**, trigger trên `ledger_entries` không bao giờ chạy (không có dòng nào được thêm). Trigger
thứ hai chạy khi giao dịch được tạo, nên bắt được trường hợp này.

### Trigger chỉ-thêm (append-only)

```sql
CREATE TRIGGER "ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "ledger_entries"   -- trước khi sửa hoặc xoá
  FOR EACH ROW EXECUTE FUNCTION "ledger_forbid_change"();  -- hàm này luôn báo lỗi
```

Vì chạy `BEFORE` và luôn báo lỗi, mọi lệnh sửa/xoá đều bị chặn trước khi kịp làm gì. Sổ cái giống
sổ kế toán viết bằng mực: ghi sai thì ghi thêm một bút toán đảo ngược, không tẩy xoá.

---

## 6. PL/pgSQL

### Là gì, vì sao cần

SQL thường chỉ là **một câu lệnh** (`SELECT`, `UPDATE`…), không có biến, không có `if`, không báo
lỗi tuỳ ý được. Trigger cần những thứ đó: tính tổng, so sánh, nếu sai thì báo lỗi.

**PL/pgSQL** là ngôn ngữ lập trình có sẵn trong Postgres để viết **hàm (function)** chạy bên trong
database: có biến, `IF`, vòng lặp, `RAISE EXCEPTION` (báo lỗi). Trigger trong Postgres luôn gọi
một hàm, và hàm đó thường viết bằng PL/pgSQL.

### Giải thích từng dòng: hàm kiểm tra cân bằng

```sql
CREATE FUNCTION "ledger_assert_balanced"() RETURNS trigger   -- (1)
LANGUAGE plpgsql AS $$                                       -- (2)
DECLARE                                                      -- (3)
  tx_id integer;
  total bigint;
  line_count integer;
BEGIN
  IF TG_TABLE_NAME = 'ledger_entries' THEN                   -- (4)
    tx_id := NEW."transaction_id";
  ELSE
    tx_id := NEW."id";
  END IF;

  SELECT COALESCE(SUM("amount"), 0), COUNT(*)                -- (5)
    INTO total, line_count
  FROM "ledger_entries" WHERE "transaction_id" = tx_id;

  IF line_count < 2 THEN                                     -- (6)
    RAISE EXCEPTION 'ledger transaction % has % entries; at least 2 are required', tx_id, line_count
      USING ERRCODE = 'check_violation';
  END IF;
  IF total <> 0 THEN                                         -- (7)
    RAISE EXCEPTION 'ledger transaction % is unbalanced: entries sum to %', tx_id, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;                                               -- (8)
END $$;
```

1. Tạo hàm tên `ledger_assert_balanced`. `RETURNS trigger` nghĩa là hàm này dành cho trigger.
2. Viết bằng PL/pgSQL. Phần thân nằm giữa hai dấu `$$`.
3. `DECLARE`: khai báo biến, giống `let` trong TypeScript.
4. Hàm được gọi từ hai bảng. `TG_TABLE_NAME` là tên bảng đã kích hoạt trigger; `NEW` là dòng vừa
   được thêm. Từ `ledger_entries` thì lấy mã giao dịch qua `transaction_id`; từ
   `ledger_transactions` thì chính là `id`.
5. Cộng `amount` và đếm số dòng của giao dịch đó, lưu vào hai biến. `COALESCE(…, 0)`: không có
   dòng nào thì tổng là 0 thay vì `NULL`.
6. Ít hơn 2 dòng → báo lỗi. `RAISE EXCEPTION` làm **cả transaction bị huỷ**. `%` là chỗ điền giá
   trị vào thông báo, giống template string.
7. Tổng khác 0 → báo lỗi.
8. Trigger `AFTER` không cần trả về gì có ý nghĩa, nên trả `NULL`.

**Chuyện thật trong project:** bản đầu tiên viết bước (4) bằng `CASE` trên một dòng. PL/pgSQL đọc
`NEW."transaction_id"` ngay cả khi trigger chạy từ `ledger_transactions` (bảng không có cột đó),
nên báo lỗi. Test `test/db/constraints.test.ts` bắt được bug này trước khi commit; đổi sang `IF`
thì PL/pgSQL chỉ đọc nhánh thực sự chạy. Đây là lý do code trong database cũng phải có test.

### Hàm cấm sửa

```sql
CREATE FUNCTION "ledger_forbid_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;
```

Luôn báo lỗi. `TG_OP` là thao tác (`UPDATE` hoặc `DELETE`), dùng để thông báo lỗi rõ ràng.

---

## 7. View

**View là một câu `SELECT` được đặt tên.** Dùng như một bảng, nhưng không lưu dữ liệu: mỗi lần đọc
là chạy lại câu truy vấn, nên luôn đúng với dữ liệu hiện tại.

```sql
CREATE VIEW "account_balances" AS
SELECT
  a."id" AS "account_id", a."code", a."type", a."user_id",
  CASE WHEN a."type" = 'ASSET' THEN 1 ELSE -1 END      -- tài sản giữ dấu, còn lại đảo dấu
    * COALESCE(SUM(e."amount"), 0)::bigint AS "balance" -- cộng mọi dòng của tài khoản
FROM "accounts" a
LEFT JOIN "ledger_entries" e ON e."account_id" = a."id" -- LEFT: tài khoản chưa có dòng nào vẫn hiện, số dư 0
GROUP BY a."id";                                        -- gom theo từng tài khoản
```

Thay vì viết lại câu dài này mỗi lần, chỉ cần `SELECT * FROM account_balances`. Đây chính là cách
"mọi số dư được suy ra từ sổ cái" như đề bài yêu cầu.

---

## 8. WITH (CTE) – gộp nhiều bước vào một câu SQL

**`WITH` (Common Table Expression, CTE) cho phép chia một câu SQL dài thành nhiều bước có tên**,
bước sau dùng kết quả của bước trước. Giống khai báo biến trong code:

```
WITH buoc_1 AS (...),          -- const buoc1 = ...
     buoc_2 AS (... buoc_1 ...) -- const buoc2 = f(buoc1)
SELECT ... FROM buoc_2         -- return ...
```

Trong Postgres, mỗi bước còn có thể là `UPDATE`/`INSERT`/`DELETE` (kèm `RETURNING`), nên cả một chuỗi
"sửa bảng này rồi dùng kết quả sửa bảng kia" chỉ cần **một lần gửi tới database**.

### Ví dụ thật: cho đơn hết hạn và trả vé (`apps/api/src/modules/orders/order-expiry.ts`)

Giả sử có 3 đơn đang chờ đã quá hạn:

| Đơn | listing_id | quantity |
| --- | ---------- | -------- |
| 7   | 1          | 2        |
| 8   | 1          | 1        |
| 9   | 4          | 3        |

```sql
WITH batch AS (
  SELECT id
  FROM orders
  WHERE status = 'PENDING' AND expires_at < now()
  ORDER BY expires_at, id
  LIMIT 1000
  FOR UPDATE SKIP LOCKED
),
```

**Bước 1 – `batch`**: chọn các đơn đang chờ đã quá hạn, **cũ nhất trước**, **tối đa 1.000 đơn**, và
**khoá chúng lại** để không ai khác sửa được trong lúc mình đang xử lý. Hai cụm cuối:

- `FOR UPDATE`: khoá những dòng vừa chọn (giống `UPDATE` tự khoá, xem mục 4).
- `SKIP LOCKED`: **dòng nào đang bị transaction khác khoá thì bỏ qua**, không đứng chờ. Ví dụ đúng lúc
  đó đơn 8 đang được ghi nhận thanh toán: lượt quét này bỏ qua đơn 8, lượt sau (1 phút nữa) mới xét
  lại nó, lúc đó có thể nó đã là `PAID` và không còn khớp điều kiện.

Kết quả `batch`: đơn 7, 8, 9 (giả sử không ai đang khoá).

```sql
expired AS (
  UPDATE orders
  SET status = 'EXPIRED', updated_at = now()
  FROM batch
  WHERE orders.id = batch.id
  RETURNING orders.listing_id, orders.quantity
),
```

**Bước 2 – `expired`**: đổi **đúng những đơn trong `batch`** thành `EXPIRED`. `RETURNING` trả lại những
dòng vừa sửa, nên "bảng tạm" `expired` chứa:

| listing_id | quantity |
| ---------- | -------- |
| 1          | 2        |
| 1          | 1        |
| 4          | 3        |

```sql
released AS (
  SELECT listing_id, SUM(quantity)::int AS tickets
  FROM expired
  GROUP BY listing_id
),
```

**Bước 3 – `released`**: gom theo tin đăng và cộng số vé (hai đơn của tin 1 được cộng lại):

| listing_id | tickets |
| ---------- | ------- |
| 1          | 3       |
| 4          | 3       |

`::int` đổi kết quả `SUM` (Postgres trả kiểu `bigint`) về số nguyên thường.

```sql
restocked AS (
  UPDATE listings
  SET quantity_available = listings.quantity_available + released.tickets, updated_at = now()
  FROM released
  WHERE listings.id = released.listing_id
  RETURNING listings.id
)
```

**Bước 4 – `restocked`**: `UPDATE ... FROM` là "cập nhật bảng `listings` bằng dữ liệu lấy từ
`released`", ghép theo `listings.id = released.listing_id`. Tin 1 được cộng 3 vé, tin 4 được cộng 3
vé, **trong cùng một lệnh**.

```sql
SELECT COUNT(*)::int AS expired FROM expired;
```

**Bước 5**: trả về số đơn đã hết hạn (ở đây là 3) để code ghi log.

Lưu ý: bước 4 không được bước 5 dùng tới, nhưng Postgres **luôn chạy mọi bước có `UPDATE`/`INSERT`/
`DELETE` đúng một lần**, dù kết quả của nó có được dùng hay không.

### Chia lô: vì sao có `LIMIT 1000`

Nếu một lúc có 100.000 đơn quá hạn (ví dụ hệ thống tắt cả buổi rồi bật lại), một transaction xử lý cả
100.000 đơn sẽ khoá rất nhiều dòng trong khoảng một giây. Code chạy câu trên **từng lô 1.000 đơn, mỗi
lô một transaction**, lặp tới khi một lô trả về ít hơn 1.000 đơn:

```ts
for (;;) {
  const count = await prisma.$transaction((tx) => expireStaleOrders(tx, {}, batchSize));
  total += count;
  if (count < batchSize) return total; // lô cuối chưa đầy → đã hết đơn quá hạn
}
```

Giữa hai lô, khoá được nhả ra, nên người mua vé không phải chờ lâu.

### Vì sao nhanh hơn nhiều

Cách cũ: một câu `UPDATE` cho đơn, rồi **mỗi tin đăng một câu `UPDATE`** gửi riêng. 1.000 tin đăng =
1.001 lần gửi đi rồi chờ kết quả. Cách mới: **1 lần**. Đo trên 1 triệu đơn:

| Đơn quá hạn          | Mỗi tin một câu | Một câu `WITH` |
| -------------------- | --------------- | -------------- |
| 100                  | 86 ms           | 5 ms           |
| 1.000 trên 1.000 tin | 551 ms          | 22 ms          |

Tin đăng cũng bị khoá ngắn hơn tương ứng, nên người đang mua vé ít phải chờ hơn.

### Vì sao vẫn an toàn khi chạy lại hoặc chạy song song

`WHERE status = 'PENDING'` chỉ khớp đơn **chưa** hết hạn. Chạy lần hai, `batch` rỗng → `expired`
rỗng → không tin đăng nào được cộng vé. Hai lượt chạy cùng lúc: lượt sau **bỏ qua** những đơn lượt
trước đang khoá (`SKIP LOCKED`), nên mỗi đơn chỉ được xử lý đúng một lần.

### Tham số an toàn

Trong code, phần lọc thêm (một đơn hoặc một tin đăng) được ghép bằng `Prisma.sql`:

```ts
const onlyOrder = scope.orderId === undefined ? Prisma.empty : Prisma.sql`AND id = ${scope.orderId}`;
```

`${...}` ở đây **không** nối chuỗi: Prisma gửi giá trị dưới dạng tham số (`$1`), nên không thể bị
SQL injection (xem mục index phía trên về `$1, $2`).

---

## 9. Migration

**Migration là một file SQL mô tả một lần thay đổi cấu trúc database** (tạo bảng, thêm cột, thêm
index…). Các file được đánh số theo thời gian và chạy lần lượt.

```
apps/api/prisma/migrations/
  20261027023937_init/migration.sql    ← lần thay đổi đầu tiên
  (sau này) 2026..._add_something/migration.sql
```

Vì sao không sửa tay database? Vì máy bạn, máy reviewer, CI và server phải có **cùng một cấu
trúc**. Migration là "công thức" để dựng lại database giống hệt ở bất kỳ đâu.

- Postgres lưu migration nào đã chạy trong bảng `_prisma_migrations`.
- `npm run db:migrate` (khi phát triển): so `schema.prisma` với database, sinh file migration mới
  và chạy nó.
- `npm run db:deploy` (Docker, CI): chỉ chạy những migration chưa chạy, không sinh gì mới.
- **Quy tắc:** migration đã commit và đã chạy ở nơi khác thì **không sửa nữa**; muốn đổi thì tạo
  migration mới. (Project từng sửa migration `init` một lần, vì lúc đó nó chưa commit và chỉ chạy
  trên database dev của bạn.)

Prisma sinh nửa đầu migration từ `schema.prisma`. Nửa sau (ràng buộc `CHECK`, trigger, view) là SQL
viết tay, vì ngôn ngữ schema của Prisma không diễn đạt được những thứ đó.

---

## 10. Kiểu dữ liệu đáng chú ý

| Kiểu          | Dùng cho                   | Vì sao                                                                          |
| ------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `bigint`      | Mọi số tiền                | Số nguyên 64-bit, chính xác tuyệt đối; VND không có số lẻ                       |
| `timestamptz` | Mọi thời điểm              | Lưu kèm múi giờ (thực chất lưu theo UTC). Server ở đâu cũng không lệch giờ      |
| `enum`        | Trạng thái, vai trò        | Chỉ nhận đúng các giá trị đã khai báo; gõ `'PAYED'` là bị từ chối               |
| `jsonb`       | Nguyên văn thông báo VNPay | Lưu dữ liệu có cấu trúc thay đổi được mà vẫn truy vấn được bên trong            |
| `text`        | Chuỗi                      | Trong Postgres, `text` và `varchar` nhanh như nhau; không cần đặt độ dài tối đa |

---

## 11. Bảng tóm tắt

| Khái niệm   | Một câu                                | Trong project dùng để                                                            |
| ----------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Ràng buộc   | Luật database tự kiểm tra khi ghi      | Chặn số vé âm, đơn tính sai tiền, trạng thái mâu thuẫn                           |
| Khoá ngoại  | Giá trị phải tồn tại ở bảng khác       | Không có đơn của người dùng không tồn tại; không xoá được dữ liệu tiền đang dùng |
| Index       | Mục lục sắp xếp sẵn để tìm nhanh       | Trang sự kiện, đơn của tôi, quét đơn hết hạn, tính số dư                         |
| Unique      | Không trùng                            | Chống ghi sổ hai lần, một payment mỗi đơn                                        |
| Transaction | Tất cả hoặc không gì cả                | Đơn `PAID` + payment + sổ cái luôn đi cùng nhau                                  |
| Khoá dòng   | Đang sửa thì người khác đợi            | Hai người không mua được cùng một vé cuối                                        |
| Trigger     | Code tự chạy khi có thay đổi trên bảng | Sổ cái phải cân, không được sửa/xoá                                              |
| PL/pgSQL    | Ngôn ngữ viết hàm chạy trong Postgres  | Thân của các trigger                                                             |
| View        | Câu `SELECT` được đặt tên              | `account_balances`: số dư suy ra từ sổ cái                                       |
| Migration   | File SQL mô tả một lần đổi cấu trúc    | Dựng database giống hệt ở máy bạn, CI, Docker                                    |
