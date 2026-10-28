// Design-phase fixtures. Deleted once services call the real api (step 4).

export const MOCK_TRIAL_BALANCE = [
  { account: 'platform:gateway_clearing', balance: 2_310_000 },
  { account: 'seller:1:pending', balance: -855_000 },
  { account: 'seller:1:available', balance: -1_140_000 },
  { account: 'platform:fee_pending', balance: -135_000 },
  { account: 'platform:fee_revenue', balance: -180_000 },
];
