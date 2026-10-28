export const EVENT_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const LISTING_STATUSES = ['ACTIVE', 'WITHDRAWN'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LEDGER_TRANSACTION_KINDS = [
  'PAYMENT_CAPTURED',
  'EVENT_SETTLED',
  'ORDER_CANCELLED',
  'LATE_PAYMENT',
  'REFUND_COMPLETED',
] as const;
export type LedgerTransactionKind = (typeof LEDGER_TRANSACTION_KINDS)[number];

export const REFUND_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
