// Ledger account codes. Platform accounts are created by the seed; per-user accounts
// are created on first use.
export const PLATFORM_ACCOUNTS = {
  gatewayClearing: 'platform:gateway_clearing', // asset: money the gateway collected for us
  feePending: 'platform:fee_pending', // liability: our fee, not yet earned
  feeRevenue: 'platform:fee_revenue', // revenue: our fee, earned when the event completes
} as const;

export const sellerPendingAccount = (userId: number) => `seller:${userId}:pending`;
export const sellerAvailableAccount = (userId: number) => `seller:${userId}:available`;
export const buyerRefundPayableAccount = (userId: number) => `buyer:${userId}:refund_payable`;
