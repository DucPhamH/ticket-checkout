import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import type { EventSummaryDto } from '@tc/shared';

const app = createApp();
const TEST_TAG = '[events.test]';
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

let mixedId: number;
let emptyId: number;
let completedId: number;

beforeAll(async () => {
  const seller = await prisma.user.findFirstOrThrow({ where: { name: 'Alice Nguyen' } });
  const base = { description: '', venue: 'Test venue', city: 'Test city' };

  const mixed = await prisma.event.create({ data: { ...base, name: `${TEST_TAG} mixed`, startsAt: inDays(400) } });
  await prisma.listing.createMany({
    data: [
      // on sale
      { eventId: mixed.id, sellerId: seller.id, unitPrice: 300_000n, quantityTotal: 2, quantityAvailable: 2 },
      // cheaper but sold out: must not count
      { eventId: mixed.id, sellerId: seller.id, unitPrice: 100_000n, quantityTotal: 1, quantityAvailable: 0 },
      // cheaper but withdrawn: must not count
      {
        eventId: mixed.id,
        sellerId: seller.id,
        unitPrice: 50_000n,
        quantityTotal: 5,
        quantityAvailable: 5,
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
      },
    ],
  });
  mixedId = mixed.id;

  emptyId = (await prisma.event.create({ data: { ...base, name: `${TEST_TAG} empty`, startsAt: inDays(401) } })).id;
  completedId = (
    await prisma.event.create({
      data: {
        ...base,
        name: `${TEST_TAG} completed`,
        startsAt: inDays(1),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })
  ).id;
});

afterAll(async () => {
  const events = await prisma.event.findMany({ where: { name: { startsWith: TEST_TAG } }, select: { id: true } });
  const ids = events.map((event) => event.id);
  await prisma.listing.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

async function getEvents(): Promise<EventSummaryDto[]> {
  const res = await request(app).get('/events');
  expect(res.status).toBe(200);
  return res.body;
}

describe('GET /events', () => {
  it('returns seeded events soonest first with price and stock', async () => {
    const seeded = (await getEvents()).filter((event) => !event.name.startsWith(TEST_TAG));
    expect(seeded.map((event) => event.name)).toEqual(['Saigon Jazz Festival', 'Hà Nội Indie Night 2026']);
    expect(seeded[1]).toMatchObject({ minPrice: 450_000, ticketsAvailable: 9, status: 'ACTIVE' });
    expect(seeded[0]).toMatchObject({ minPrice: 650_000, ticketsAvailable: 8 });
  });

  it('ignores sold-out and withdrawn listings', async () => {
    const mixed = (await getEvents()).find((event) => event.id === mixedId);
    expect(mixed).toMatchObject({ minPrice: 300_000, ticketsAvailable: 2 });
  });

  it('reports an event with nothing on sale as null price and zero tickets', async () => {
    const empty = (await getEvents()).find((event) => event.id === emptyId);
    expect(empty).toMatchObject({ minPrice: null, ticketsAvailable: 0 });
  });

  it('hides events that are no longer active', async () => {
    expect((await getEvents()).some((event) => event.id === completedId)).toBe(false);
  });

  it('returns dates as ISO strings and money as numbers', async () => {
    const [event] = await getEvents();
    expect(typeof event.minPrice).toBe('number');
    expect(new Date(event.startsAt).toISOString()).toBe(event.startsAt);
  });
});

describe('GET /events/:id', () => {
  it('returns the event with its listings cheapest first, including the seller', async () => {
    const res = await request(app).get('/events/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Hà Nội Indie Night 2026', minPrice: 450_000, ticketsAvailable: 9 });
    expect(res.body.listings.map((l: { unitPrice: number }) => l.unitPrice)).toEqual([450_000, 520_000, 1_200_000]);
    expect(res.body.listings[0].seller).toEqual({ id: 1, name: 'Alice Nguyen' });
  });

  it('only lists listings that are active and not sold out', async () => {
    const res = await request(app).get(`/events/${mixedId}`);
    expect(res.body.listings).toHaveLength(1);
    expect(res.body).toMatchObject({ minPrice: 300_000, ticketsAvailable: 2 });
  });

  it('returns an inactive event without listings', async () => {
    const res = await request(app).get(`/events/${completedId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'COMPLETED', listings: [], minPrice: null, ticketsAvailable: 0 });
  });

  it('answers 404 for an unknown event', async () => {
    const res = await request(app).get('/events/999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5'])('answers 400 for id %s', async (id) => {
    const res = await request(app).get(`/events/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/^id: /);
  });
});
