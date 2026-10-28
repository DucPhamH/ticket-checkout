// Design-phase fixtures. Deleted once services call the real api (step 4).
import type { LedgerLineDto, OrderDto } from '@tc/shared';

const ORDER_BASE = {
  event: {
    id: 1,
    name: 'Hà Nội Indie Night 2026',
    venue: 'Cung Điền kinh Mỹ Đình',
    startsAt: '2026-12-12T12:30:00.000Z',
  },
  seller: { id: 1, name: 'Alice Nguyen' },
  quantity: 2,
  unitPrice: 450_000,
  subtotal: 900_000,
  buyerFee: 90_000,
  total: 990_000,
  createdAt: '2026-10-27T03:00:00.000Z',
  expiresAt: '2026-10-27T03:15:00.000Z',
};

// Order ids map to statuses so every result screen can be previewed.
export const MOCK_ORDERS: OrderDto[] = [
  { ...ORDER_BASE, id: 101, status: 'PAID', paidAt: '2026-10-27T03:02:00.000Z' },
  { ...ORDER_BASE, id: 102, status: 'PENDING', paidAt: null },
  { ...ORDER_BASE, id: 103, status: 'FAILED', paidAt: null },
  { ...ORDER_BASE, id: 104, status: 'EXPIRED', paidAt: null },
  { ...ORDER_BASE, id: 105, status: 'REFUNDED', paidAt: '2026-10-25T03:02:00.000Z' },
];

export const MOCK_LEDGER: LedgerLineDto[] = [
  {
    id: 3,
    createdAt: '2026-10-27T03:02:00.000Z',
    kind: 'PAYMENT_CAPTURED',
    account: 'seller:1:pending',
    amount: -855_000,
    orderId: 101,
    eventId: 1,
  },
  {
    id: 7,
    createdAt: '2026-10-20T09:00:00.000Z',
    kind: 'EVENT_SETTLED',
    account: 'seller:1:available',
    amount: -1_140_000,
    orderId: null,
    eventId: 3,
  },
  {
    id: 6,
    createdAt: '2026-10-20T09:00:00.000Z',
    kind: 'EVENT_SETTLED',
    account: 'seller:1:pending',
    amount: 1_140_000,
    orderId: null,
    eventId: 3,
  },
];

export const MOCK_TRIAL_BALANCE = [
  { account: 'platform:gateway_clearing', balance: 2_310_000 },
  { account: 'seller:1:pending', balance: -855_000 },
  { account: 'seller:1:available', balance: -1_140_000 },
  { account: 'platform:fee_pending', balance: -135_000 },
  { account: 'platform:fee_revenue', balance: -180_000 },
];
