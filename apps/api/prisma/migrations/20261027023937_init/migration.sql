-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('VNPAY');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "payment_notification_source" AS ENUM ('IPN', 'RETURN', 'QUERY');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE');

-- CreateEnum
CREATE TYPE "ledger_transaction_kind" AS ENUM ('PAYMENT_CAPTURED', 'EVENT_SETTLED', 'ORDER_CANCELLED', 'LATE_PAYMENT', 'REFUND_COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "venue" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "quantity_total" INTEGER NOT NULL,
    "quantity_available" INTEGER NOT NULL,
    "status" "listing_status" NOT NULL DEFAULT 'ACTIVE',
    "withdrawn_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "listing_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "buyer_fee" BIGINT NOT NULL,
    "seller_fee" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "provider" "payment_provider" NOT NULL DEFAULT 'VNPAY',
    "txn_ref" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "provider_transaction_no" TEXT,
    "provider_response_code" TEXT,
    "provider_pay_date" TEXT,
    "bank_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_notifications" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER,
    "source" "payment_notification_source" NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "result" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider_response" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "account_type" NOT NULL,
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" SERIAL NOT NULL,
    "kind" "ledger_transaction_kind" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "order_id" INTEGER,
    "event_id" INTEGER,
    "refund_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_status_starts_at_idx" ON "events"("status", "starts_at");

-- CreateIndex
CREATE INDEX "listings_event_id_status_idx" ON "listings"("event_id", "status");

-- CreateIndex
CREATE INDEX "listings_seller_id_idx" ON "listings"("seller_id");

-- CreateIndex
CREATE INDEX "orders_buyer_id_created_at_idx" ON "orders"("buyer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_listing_id_idx" ON "orders"("listing_id");

-- CreateIndex
CREATE INDEX "orders_status_expires_at_idx" ON "orders"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_txn_ref_key" ON "payments"("txn_ref");

-- CreateIndex
CREATE INDEX "payment_notifications_payment_id_received_at_idx" ON "payment_notifications"("payment_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_order_id_key" ON "refunds"("order_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_key" ON "ledger_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_transactions_order_id_idx" ON "ledger_transactions"("order_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_event_id_idx" ON "ledger_transactions"("event_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_refund_id_idx" ON "ledger_transactions"("refund_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_idx" ON "ledger_entries"("account_id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_notifications" ADD CONSTRAINT "payment_notifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Hand-written below: rules Prisma's schema language cannot express.
-- The application enforces these too; the database is the last line of defence.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Events: status and its timestamp move together.
ALTER TABLE "events"
  ADD CONSTRAINT "events_completed_at_matches_status" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
  ADD CONSTRAINT "events_cancelled_at_matches_status" CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));

-- Listings: positive price, and availability never below zero or above the total.
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_unit_price_positive" CHECK ("unit_price" > 0),
  ADD CONSTRAINT "listings_quantity_total_positive" CHECK ("quantity_total" > 0),
  ADD CONSTRAINT "listings_quantity_available_range" CHECK ("quantity_available" BETWEEN 0 AND "quantity_total"),
  ADD CONSTRAINT "listings_withdrawn_at_matches_status" CHECK (("status" = 'WITHDRAWN') = ("withdrawn_at" IS NOT NULL));

-- Orders: the frozen amounts must be internally consistent.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "orders_subtotal_matches" CHECK ("subtotal" = "unit_price" * "quantity"),
  ADD CONSTRAINT "orders_fees_non_negative" CHECK ("buyer_fee" >= 0 AND "seller_fee" >= 0 AND "seller_fee" <= "subtotal"),
  ADD CONSTRAINT "orders_total_matches" CHECK ("total" = "subtotal" + "buyer_fee");

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount" > 0);

-- Ledger entries: a zero line carries no information and usually means a bug.
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_non_zero" CHECK ("amount" <> 0);

-- Ledger rule 1: every transaction balances (entries sum to zero) and has at least two lines.
-- Constraint triggers are DEFERRED, so the check runs at COMMIT, after all lines are inserted.
-- Fired from both tables so a transaction with no entries at all is also rejected.
CREATE FUNCTION "ledger_assert_balanced"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  tx_id integer;
  total bigint;
  line_count integer;
BEGIN
  -- IF, not CASE: PL/pgSQL only resolves NEW.<column> in the branch that actually runs.
  IF TG_TABLE_NAME = 'ledger_entries' THEN
    tx_id := NEW."transaction_id";
  ELSE
    tx_id := NEW."id";
  END IF;

  SELECT COALESCE(SUM("amount"), 0), COUNT(*) INTO total, line_count
  FROM "ledger_entries" WHERE "transaction_id" = tx_id;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'ledger transaction % has % entries; at least 2 are required', tx_id, line_count
      USING ERRCODE = 'check_violation';
  END IF;
  IF total <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced: entries sum to %', tx_id, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "ledger_entries_balanced"
  AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ledger_assert_balanced"();

CREATE CONSTRAINT TRIGGER "ledger_transactions_balanced"
  AFTER INSERT ON "ledger_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ledger_assert_balanced"();

-- Ledger rule 2: append-only. Corrections are new, reversing transactions, never edits.
CREATE FUNCTION "ledger_forbid_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER "ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "ledger_forbid_change"();

CREATE TRIGGER "ledger_transactions_append_only"
  BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION "ledger_forbid_change"();

-- Convenience view for humans and the admin page. Balances in their natural sign:
-- assets are debit-positive; liabilities and revenue are credit-positive.
CREATE VIEW "account_balances" AS
SELECT
  a."id" AS "account_id",
  a."code",
  a."type",
  a."user_id",
  CASE WHEN a."type" = 'ASSET' THEN 1 ELSE -1 END * COALESCE(SUM(e."amount"), 0)::bigint AS "balance"
FROM "accounts" a
LEFT JOIN "ledger_entries" e ON e."account_id" = a."id"
GROUP BY a."id";
