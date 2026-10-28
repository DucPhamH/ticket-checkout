// Design-phase fixtures. Deleted once services call the real api (step 4).
import type { LedgerLineDto } from '@tc/shared';

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
