// Money is BIGINT in the database (Prisma `bigint`) and `number` in JSON, which has no bigint.
// VND amounts stay far below 2^53, but convert defensively so an overflow fails loudly.
export function toNumber(amount: bigint): number {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`Amount ${amount} does not fit in a JSON number`);
  }
  return Number(amount);
}
