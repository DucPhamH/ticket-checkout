import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ACCOUNTS } from '../../src/constants/ledger';
import { prisma } from '../../src/db/prisma';
import { credit, debit, postTransaction } from '../../src/modules/ledger/ledger.service';

// Relies on the seed: user 4 is the admin, user 3 a buyer.
const app = createApp();
const TAG = '[admin.test]';
const ADMIN = '4';
const BUYER = '3';

afterAll(() => prisma.$disconnect());

describe('admin access', () => {
  it('refuses a user who is not an admin', async () => {
    const res = await request(app).get('/admin/trial-balance').set('X-User-Id', BUYER);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_ONLY');
  });

  it('refuses a request without a user', async () => {
    const res = await request(app).get('/admin/trial-balance');
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/trial-balance', () => {
  it('lists every account with its signed balance, totalling zero', async () => {
    const seller = (await prisma.user.create({ data: { name: `${TAG} seller` } })).id;
    await prisma.$transaction((tx) =>
      postTransaction(tx, {
        kind: 'PAYMENT_CAPTURED',
        idempotencyKey: `${TAG}:capture:${seller}`,
        lines: [
          debit(ACCOUNTS.gatewayClearing, 715_000n),
          credit(ACCOUNTS.sellerPending(seller), 617_500n),
          credit(ACCOUNTS.feePending, 97_500n),
        ],
      }),
    );

    const res = await request(app).get('/admin/trial-balance').set('X-User-Id', ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.accounts).toContainEqual({
      code: `seller:${seller}:pending`,
      type: 'LIABILITY',
      balance: -617_500,
    });
    // Seeded platform accounts appear even before they are used.
    const codes = res.body.accounts.map((account: { code: string }) => account.code);
    expect(codes).toEqual(expect.arrayContaining(['platform:gateway_clearing', 'platform:fee_revenue']));
    expect(res.body.accounts.reduce((sum: number, a: { balance: number }) => sum + a.balance, 0)).toBe(0);
  });
});
