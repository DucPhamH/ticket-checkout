import type { EventStatus, LedgerTransactionKind, ListingStatus, OrderStatus, UserRole } from '../constants/status';

// Shapes returned by the api. Money is in VND (integer); dates are ISO strings.

export type UserDto = {
  id: number;
  name: string;
  role: UserRole;
};

export type EventSummaryDto = {
  id: number;
  name: string;
  venue: string;
  city: string;
  startsAt: string;
  status: EventStatus;
  minPrice: number | null;
  ticketsAvailable: number;
};

export type ListingDto = {
  id: number;
  eventId: number;
  seller: { id: number; name: string };
  unitPrice: number;
  quantityAvailable: number;
  quantityTotal: number;
  status: ListingStatus;
};

export type EventDetailDto = EventSummaryDto & {
  description: string;
  listings: ListingDto[];
};

export type OrderDto = {
  id: number;
  status: OrderStatus;
  event: { id: number; name: string; venue: string; startsAt: string };
  seller: { id: number; name: string };
  quantity: number;
  unitPrice: number;
  subtotal: number;
  buyerFee: number;
  total: number;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
};

export type BalancesDto = {
  pending: number; // seller money held in escrow
  available: number; // seller money released after the event
  refundPending: number; // money we owe back to this user as a buyer
};

export type LedgerLineDto = {
  id: number;
  createdAt: string;
  kind: LedgerTransactionKind;
  account: string;
  amount: number; // signed: + debit, − credit
  orderId: number | null;
  eventId: number | null;
};

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type CreateOrderInput = {
  listingId: number;
  quantity: number;
  // Language of the payment page and of the page the buyer returns to. Defaults to "vi".
  locale?: SupportedLocale;
};

export type CreateOrderResponse = {
  order: OrderDto;
  // Signed VNPay URL; the buyer's browser is sent here to pay.
  paymentUrl: string;
};

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'REVENUE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type TrialBalanceDto = {
  accounts: { code: string; type: AccountType; balance: number }[]; // signed: + debit, − credit
  total: number; // always 0 in a healthy ledger
};

export type AdminEventDto = {
  id: number;
  name: string;
  venue: string;
  startsAt: string;
  status: EventStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  paidOrders: number; // orders paid for and not refunded
  ticketsSold: number;
  paidTotal: number; // what buyers paid for those orders, fees included
};
