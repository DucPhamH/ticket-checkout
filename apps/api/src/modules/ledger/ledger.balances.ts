import { ACCOUNTS } from '../../constants/ledger';
import { prisma } from '../../db/prisma';
import { Prisma } from '../../generated/prisma/client';
import type { AccountType } from '../../generated/prisma/enums';

// What we owe one user, in VND. All three are liability accounts, so a credit increases them.
export type UserBalances = {
  pending: bigint; // seller money held in escrow until the event
  available: bigint; // seller money released after the event
  refundPending: bigint; // money owed back to this user as a buyer
};

/**
 * A user's balances, summed from the ledger on every call: there is no stored balance that could
 * drift from the entries. Accounts the user has never used count as 0.
 */
export async function getUserBalances(userId: number, db: Prisma.TransactionClient = prisma): Promise<UserBalances> {
  const codes = {
    pending: ACCOUNTS.sellerPending(userId).code,
    available: ACCOUNTS.sellerAvailable(userId).code,
    refundPending: ACCOUNTS.buyerRefundPayable(userId).code,
  };

  // Entries are signed debit-positive; flipping the sign gives a liability's natural balance.
  const rows = await db.$queryRaw<{ code: string; balance: bigint }[]>`
    SELECT a.code, -COALESCE(SUM(e.amount), 0)::bigint AS balance
    FROM accounts a
    LEFT JOIN ledger_entries e ON e.account_id = a.id
    WHERE a.code IN (${Prisma.join(Object.values(codes))})
    GROUP BY a.code
  `;
  const balanceOf = (code: string) => rows.find((row) => row.code === code)?.balance ?? 0n;

  return {
    pending: balanceOf(codes.pending),
    available: balanceOf(codes.available),
    refundPending: balanceOf(codes.refundPending),
  };
}

export type TrialBalance = {
  accounts: { code: string; type: AccountType; balance: bigint }[];
  total: bigint;
};

/**
 * Every account's balance as stored (debit-positive), and their total. Each posting sums to zero,
 * so the total must be zero; anything else means the ledger is broken.
 */
export async function getTrialBalance(db: Prisma.TransactionClient = prisma): Promise<TrialBalance> {
  const accounts = await db.$queryRaw<TrialBalance['accounts']>`
    SELECT a.code, a.type, COALESCE(SUM(e.amount), 0)::bigint AS balance
    FROM accounts a
    LEFT JOIN ledger_entries e ON e.account_id = a.id
    GROUP BY a.id
    ORDER BY a.code
  `;
  return { accounts, total: accounts.reduce((sum, account) => sum + account.balance, 0n) };
}
