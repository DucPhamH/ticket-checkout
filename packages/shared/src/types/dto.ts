import type { EventStatus, ListingStatus, OrderStatus, UserRole } from '../constants/status';

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
  imageUrl: string | null;
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
  kind: string;
  account: string;
  amount: number; // signed: + debit, − credit
  orderId: number | null;
  eventId: number | null;
};
