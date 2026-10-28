import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { encodeCursor } from '../../src/lib/pagination';

const app = createApp();
const TAG = '[my-orders.test]';

let eventId: number;
let listingId: number;

const newBuyer = async () => (await prisma.user.create({ data: { name: `${TAG} buyer` } })).id;

// Real orders, created through the api as the buyer would.
async function buyMany(buyerId: number, count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app).post('/orders').set('X-User-Id', String(buyerId)).send({ listingId, quantity: 1 });
    ids.push(res.body.order.id);
  }
  return ids;
}

const myOrders = (buyerId: number, query: Record<string, string | number> = {}) =>
  request(app).get('/me/orders').set('X-User-Id', String(buyerId)).query(query);

// Follows nextCursor to the end, returning every order id in the order received.
async function walk(buyerId: number, limit: number) {
  const ids: number[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const res = await myOrders(buyerId, cursor ? { limit, cursor } : { limit });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(limit);
    ids.push(...res.body.items.map((order: { id: number }) => order.id));
    cursor = res.body.nextCursor;
    pages++;
  } while (cursor);
  return { ids, pages };
}

beforeAll(async () => {
  const seller = await prisma.user.create({ data: { name: `${TAG} seller` } });
  eventId = (
    await prisma.event.create({
      data: { name: `${TAG} event`, venue: 'v', city: 'c', startsAt: new Date(Date.now() + 86_400_000) },
    })
  ).id;
  listingId = (
    await prisma.listing.create({
      data: { eventId, sellerId: seller.id, unitPrice: 100_000n, quantityTotal: 100, quantityAvailable: 100 },
    })
  ).id;
});

// No cleanup: the test database is recreated on every run.
afterAll(() => prisma.$disconnect());

describe('GET /me/orders', () => {
  it('lists my orders newest first, page by page, each exactly once', async () => {
    const buyer = await newBuyer();
    const created = await buyMany(buyer, 5);

    const { ids, pages } = await walk(buyer, 2);

    expect(ids).toEqual([...created].reverse());
    expect(pages).toBe(3); // 2 + 2 + 1
  });

  it('keeps orders created in the same millisecond apart by id', async () => {
    const buyer = await newBuyer();
    const created = await buyMany(buyer, 4);
    await prisma.order.updateMany({
      where: { id: { in: created } },
      data: { createdAt: new Date('2026-10-28T03:00:00Z') },
    });

    expect((await walk(buyer, 1)).ids).toEqual([...created].reverse());
  });

  it('does not repeat or skip an order when a new one arrives between pages', async () => {
    const buyer = await newBuyer();
    const created = await buyMany(buyer, 3);

    const first = await myOrders(buyer, { limit: 2 });
    const [newer] = await buyMany(buyer, 1);
    const second = await myOrders(buyer, { limit: 2, cursor: first.body.nextCursor });

    expect(first.body.items.map((o: { id: number }) => o.id)).toEqual([created[2], created[1]]);
    expect(second.body.items.map((o: { id: number }) => o.id)).toEqual([created[0]]);
    expect(second.body.nextCursor).toBeNull();
    // The new order shows up on top the next time the list is opened.
    expect((await myOrders(buyer, { limit: 1 })).body.items[0].id).toBe(newer);
  });

  it('only lists my own orders', async () => {
    const me = await newBuyer();
    const other = await newBuyer();
    await buyMany(other, 2);
    const res = await myOrders(me);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it('shows a reservation past its deadline as EXPIRED and gives its ticket back', async () => {
    const buyer = await newBuyer();
    const [orderId] = await buyMany(buyer, 1);
    await prisma.order.update({ where: { id: orderId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const before = (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable;

    const res = await myOrders(buyer);

    expect(res.body.items[0]).toMatchObject({ id: orderId, status: 'EXPIRED' });
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).quantityAvailable).toBe(before + 1);
  });

  it.each([
    ['a limit above 50', { limit: 51 }],
    ['a limit of 0', { limit: 0 }],
    ['a cursor that is not base64 JSON', { cursor: 'not-a-cursor' }],
    ['a cursor with the wrong shape', { cursor: encodeCursor({ id: 'x' }) }],
  ])('rejects %s with 400', async (_case, query) => {
    const res = await myOrders(await newBuyer(), query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('defaults to 20 per page', async () => {
    const buyer = await newBuyer();
    await buyMany(buyer, 21);
    const res = await myOrders(buyer);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.nextCursor).toEqual(expect.any(String));
  });
});
