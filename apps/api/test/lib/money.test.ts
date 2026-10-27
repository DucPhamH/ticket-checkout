import { describe, expect, it } from 'vitest';
import { toNumber } from '../../src/lib/money';

describe('toNumber', () => {
  it('converts bigint VND to number', () => {
    expect(toNumber(1_100_000n)).toBe(1_100_000);
  });

  it('refuses amounts a JSON number cannot hold exactly', () => {
    expect(() => toNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});
