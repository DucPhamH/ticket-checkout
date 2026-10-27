import { calculateOrderAmounts } from '@tc/shared';
import { describe, expect, it } from 'vitest';

describe('calculateOrderAmounts', () => {
  it('applies +10% for the buyer and −5% for the seller', () => {
    expect(calculateOrderAmounts(500_000, 2)).toEqual({
      subtotal: 1_000_000,
      buyerFee: 100_000,
      total: 1_100_000,
      sellerFee: 50_000,
      sellerPayout: 950_000,
      platformRevenue: 150_000,
    });
  });

  it('rounds half up and never loses a đồng', () => {
    const amounts = calculateOrderAmounts(15, 1); // 10% = 1.5 → 2, 5% = 0.75 → 1
    expect(amounts.buyerFee).toBe(2);
    expect(amounts.sellerFee).toBe(1);
    expect(amounts.sellerPayout + amounts.platformRevenue).toBe(amounts.total);
  });

  it('always balances: total = sellerPayout + platformRevenue', () => {
    for (const price of [10_000, 123_457, 999_999, 1_250_000]) {
      for (let quantity = 1; quantity <= 10; quantity++) {
        const a = calculateOrderAmounts(price, quantity);
        expect(a.sellerPayout + a.platformRevenue).toBe(a.total);
      }
    }
  });

  it('rejects invalid input', () => {
    expect(() => calculateOrderAmounts(1.5, 1)).toThrow();
    expect(() => calculateOrderAmounts(100, 0)).toThrow();
  });
});
