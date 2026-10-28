import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { expireAllStaleOrders, expireStaleOrders } from '../../src/modules/orders/order-expiry';

const app = createApp();
const TAG = '[order-expiry.test]';
const PAST = () => new Date(Date.now() - 60_000);
const FUTURE = () => new Date(Date.now() + 15 * 60_000);

let sellerId: number;
let buyerId: number;
let eventId: number;

// A listing with `total` tickets of which `held` are reserved by orders created below.
async function makeListing(total: number, held: number) {
  const listing = await prisma.listing.create({
    data: { eventId, sellerId, unitPrice: 100_000n, quantityTotal: total, quantityAvailable: total - held },
  });
  return listing.id;
}

// Inserts an order directly (bypassing the api) so its expiry can be set in the past.
async function makeOrder(listingId: number, quantity: number, expiresAt: Date, status: 'PENDING' | 'PAID' = 'PENDING') {
  const subtotal = 100_000n * BigInt(quantity);
  const order = await prisma.order.create({
    data: {
      buyerId,
      listingId,
      quantity,
      unitPrice: 100_000n,
      subtotal,
      buyerFee: subtotal / 10n,
      sellerFee: subtotal / 20n,
      total: subtotal + subtotal / 10n,
      expiresAt,
      status,
      paidAt: status === 'PAID' ? new Date() : null,
    },
  });
  return order.id;
}

const statusOf = async (orderId: number) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;
const availableOf = async (listingId: number) =>
  (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable;

beforeAll(async () => {
  sellerId = (await prisma.user.create({ data: { name: `${TAG} seller` } })).id;
  buyerId = (await prisma.user.create({ data: { name: `${TAG} buyer` } })).id;
  eventId = (await prisma.event.create({ data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: FUTURE() } }))
    .id;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { listing: { eventId } } });
  await prisma.listing.deleteMany({ where: { eventId } });
  await prisma.event.deleteMany({ where: { id: eventId } });
  await prisma.user.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('expireAllStaleOrders', () => {
  it('expires overdue PENDING orders and gives their tickets back', async () => {
    const listingId = await makeListing(5, 3);
    const a = await makeOrder(listingId, 2, PAST());
    const b = await makeOrder(listingId, 1, PAST());

    expect(await expireAllStaleOrders()).toBeGreaterThanOrEqual(2);

    expect(await statusOf(a)).toBe('EXPIRED');
    expect(await statusOf(b)).toBe('EXPIRED');
    expect(await availableOf(listingId)).toBe(5);
  });

  it('leaves orders that are still within their reservation, or already paid', async () => {
    const listingId = await makeListing(5, 3);
    const fresh = await makeOrder(listingId, 2, FUTURE());
    const paid = await makeOrder(listingId, 1, PAST(), 'PAID');

    await expireAllStaleOrders();

    expect(await statusOf(fresh)).toBe('PENDING');
    expect(await statusOf(paid)).toBe('PAID');
    expect(await availableOf(listingId)).toBe(2);
  });

  it('releases tickets only once when run again', async () => {
    const listingId = await makeListing(4, 2);
    await makeOrder(listingId, 2, PAST());

    await expireAllStaleOrders();
    await expireAllStaleOrders();

    expect(await availableOf(listingId)).toBe(4);
  });

  it('releases tickets only once when two sweeps run at the same time', async () => {
    const listingId = await makeListing(4, 3);
    await makeOrder(listingId, 3, PAST());

    await Promise.all([expireAllStaleOrders(), expireAllStaleOrders(), expireAllStaleOrders()]);

    expect(await availableOf(listingId)).toBe(4);
  });
});

describe('expiry on read and before reserving', () => {
  it('GET /orders/:id shows an overdue order as EXPIRED straight away', async () => {
    const listingId = await makeListing(3, 1);
    const orderId = await makeOrder(listingId, 1, PAST());

    const res = await request(app).get(`/orders/${orderId}`).set('X-User-Id', String(buyerId));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('EXPIRED');
    expect(await availableOf(listingId)).toBe(3);
  });

  it('a new buyer can take tickets held by an overdue order', async () => {
    const listingId = await makeListing(1, 1); // the only ticket is held by a stale order
    await makeOrder(listingId, 1, PAST());

    const res = await request(app).post('/orders').set('X-User-Id', String(buyerId)).send({ listingId, quantity: 1 });

    expect(res.status).toBe(201);
    expect(await availableOf(listingId)).toBe(0);
  });
});

describe('batching', () => {
  it('expires at most one batch per call, oldest first', async () => {
    const listingId = await makeListing(10, 5);
    const ids: number[] = [];
    for (let i = 5; i >= 1; i--) ids.push(await makeOrder(listingId, 1, new Date(Date.now() - i * 60_000)));

    const count = await prisma.$transaction((tx) => expireStaleOrders(tx, { listingId }, 2));

    expect(count).toBe(2);
    // ids[0] and ids[1] expired the longest ago, so they go first.
    expect(await Promise.all(ids.map(statusOf))).toEqual(['EXPIRED', 'EXPIRED', 'PENDING', 'PENDING', 'PENDING']);
    expect(await availableOf(listingId)).toBe(7);
  });

  it('a full sweep keeps going batch after batch until nothing is left', async () => {
    const listingId = await makeListing(10, 5);
    const ids = await Promise.all(Array.from({ length: 5 }, () => makeOrder(listingId, 1, PAST())));

    expect(await expireAllStaleOrders(2)).toBeGreaterThanOrEqual(5); // batches of 2, 2, 1

    expect(new Set(await Promise.all(ids.map(statusOf)))).toEqual(new Set(['EXPIRED']));
    expect(await availableOf(listingId)).toBe(10);
  });
});

describe('SKIP LOCKED', () => {
  it('skips an order another transaction is holding instead of waiting for it', async () => {
    const listingId = await makeListing(3, 1);
    const orderId = await makeOrder(listingId, 1, PAST());

    // Another transaction locks the order and keeps it locked until we say so,
    // like a payment being recorded at the same moment.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
        signalLocked();
        await released;
      },
      { timeout: 10_000 },
    );
    await locked;

    const started = Date.now();
    await expireAllStaleOrders();
    const waitedMs = Date.now() - started;

    expect(waitedMs).toBeLessThan(1000); // did not wait for the lock
    expect(await statusOf(orderId)).toBe('PENDING'); // left for a later run
    expect(await availableOf(listingId)).toBe(2);

    release();
    await holder;

    await expireAllStaleOrders();
    expect(await statusOf(orderId)).toBe('EXPIRED');
    expect(await availableOf(listingId)).toBe(3);
  });
});
