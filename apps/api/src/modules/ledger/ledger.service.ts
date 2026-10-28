import type { AccountRef } from '../../constants/ledger';
import type { Prisma } from '../../generated/prisma/client';
import type { LedgerTransactionKind } from '../../generated/prisma/enums';

// One line of a double-entry transaction. Positive amount = debit, negative = credit.
export type LedgerLine = { account: AccountRef; amount: bigint };

// Readable helpers, so a posting reads like an accounting entry.
export const debit = (account: AccountRef, amount: bigint): LedgerLine => ({ account, amount });
export const credit = (account: AccountRef, amount: bigint): LedgerLine => ({ account, amount: -amount });

export type PostingInput = {
  kind: LedgerTransactionKind;
  // Identifies the business event (e.g. "capture:order:42"). Posting it again is a no-op.
  idempotencyKey: string;
  orderId?: number;
  eventId?: number;
  refundId?: number;
  lines: LedgerLine[];
};

export type PostingResult = { transactionId: number; created: boolean };

/**
 * Checks the double-entry rules before touching the database, so a bug fails loudly here
 * rather than at COMMIT. The database enforces the same rules again (trigger + CHECK).
 */
export function assertBalanced(lines: LedgerLine[]): void {
  if (lines.length < 2) throw new Error(`A ledger transaction needs at least 2 lines, got ${lines.length}`);
  if (lines.some((line) => line.amount === 0n)) throw new Error('A ledger line cannot be zero');
  const sum = lines.reduce((total, line) => total + line.amount, 0n);
  if (sum !== 0n) throw new Error(`Ledger lines must sum to zero, got ${sum}`);
}

// Gets an account by code, creating it the first time (e.g. a seller's first sale).
async function accountId(tx: Prisma.TransactionClient, account: AccountRef): Promise<number> {
  const row = await tx.account.upsert({
    where: { code: account.code },
    create: { code: account.code, type: account.type, userId: account.userId },
    update: {},
    select: { id: true },
  });
  return row.id;
}

/**
 * Records one double-entry transaction. Must run inside the caller's transaction, so the money
 * movement commits together with the business change that caused it (e.g. the order becoming PAID).
 *
 * Idempotent: the transaction header is inserted with ON CONFLICT (idempotency_key) DO NOTHING.
 * If the key was already posted, nothing is written and `created` is false. If another transaction
 * is posting the same key at that moment, Postgres makes this one wait for it, then do nothing.
 */
export async function postTransaction(tx: Prisma.TransactionClient, input: PostingInput): Promise<PostingResult> {
  assertBalanced(input.lines);

  const inserted = await tx.$queryRaw<{ id: number }[]>`
    INSERT INTO ledger_transactions (kind, idempotency_key, order_id, event_id, refund_id)
    VALUES (${input.kind}::ledger_transaction_kind, ${input.idempotencyKey},
            ${input.orderId ?? null}, ${input.eventId ?? null}, ${input.refundId ?? null})
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    const existing = await tx.ledgerTransaction.findUniqueOrThrow({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    return { transactionId: existing.id, created: false };
  }

  const transactionId = inserted[0].id;
  const data: Prisma.LedgerEntryCreateManyInput[] = [];
  for (const line of input.lines) {
    data.push({ transactionId, accountId: await accountId(tx, line.account), amount: line.amount });
  }
  await tx.ledgerEntry.createMany({ data });

  return { transactionId, created: true };
}
