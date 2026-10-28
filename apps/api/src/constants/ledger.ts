import { AccountType } from '../generated/prisma/enums';

// A ledger account: its unique code, what kind of account it is, and whose it is (if anyone's).
export type AccountRef = { code: string; type: AccountType; userId: number | null };

// Platform accounts are created by the seed; per-user accounts are created on first use.
export const ACCOUNTS = {
  // Asset: money the gateway collected for us and has not paid out.
  gatewayClearing: { code: 'platform:gateway_clearing', type: AccountType.ASSET, userId: null },
  // Liability: our fee on sales whose event has not happened yet (refundable if it is cancelled).
  feePending: { code: 'platform:fee_pending', type: AccountType.LIABILITY, userId: null },
  // Revenue: our fee, earned once the event has taken place.
  feeRevenue: { code: 'platform:fee_revenue', type: AccountType.REVENUE, userId: null },

  // Liability: a seller's money held in escrow until the event takes place.
  sellerPending: (userId: number): AccountRef => ({
    code: `seller:${userId}:pending`,
    type: AccountType.LIABILITY,
    userId,
  }),
  // Liability: released to the seller after the event.
  sellerAvailable: (userId: number): AccountRef => ({
    code: `seller:${userId}:available`,
    type: AccountType.LIABILITY,
    userId,
  }),
  // Liability: money we owe back to a buyer.
  buyerRefundPayable: (userId: number): AccountRef => ({
    code: `buyer:${userId}:refund_payable`,
    type: AccountType.LIABILITY,
    userId,
  }),
} satisfies Record<string, AccountRef | ((userId: number) => AccountRef)>;
