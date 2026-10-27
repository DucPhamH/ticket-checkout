import type { HealthResponse } from '@tc/shared';
import { prisma } from '../../db/prisma';

export async function getHealth(): Promise<HealthResponse> {
  let db: HealthResponse['db'] = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }
  return { status: 'ok', db, time: new Date().toISOString() };
}
