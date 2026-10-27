import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';

// Relies on the seed: 4 users, id 3 is the buyer "Chi Le".
const app = createApp();

afterAll(() => prisma.$disconnect());

describe('GET /users', () => {
  it('lists the seeded users ordered by id', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.map((u: { name: string }) => u.name)).toEqual(['Alice Nguyen', 'Bob Tran', 'Chi Le', 'Admin']);
    expect(res.body[3]).toEqual({ id: 4, name: 'Admin', role: 'ADMIN' });
  });
});

describe('GET /me', () => {
  it('returns the user named by X-User-Id', async () => {
    const res = await request(app).get('/me').set('X-User-Id', '3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 3, name: 'Chi Le', role: 'USER' });
  });

  it.each([
    ['missing', undefined, 'MISSING_USER_ID'],
    ['not a number', 'abc', 'INVALID_USER_ID'],
    ['not positive', '0', 'INVALID_USER_ID'],
    ['unknown', '9999', 'UNKNOWN_USER'],
  ])('rejects a %s header with 401 %s', async (_case, header, code) => {
    const req = request(app).get('/me');
    const res = header === undefined ? await req : await req.set('X-User-Id', header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(code);
  });
});
