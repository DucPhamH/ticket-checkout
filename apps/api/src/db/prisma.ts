import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/logger';

// One client per process; Prisma 7 talks to Postgres through the pg driver adapter.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: env.LOG_SQL ? [{ emit: 'event', level: 'query' }] : [],
});

if (env.LOG_SQL) {
  prisma.$on('query', (event) => {
    logger.info(
      { params: event.params, durationMs: Math.round(event.duration * 10) / 10 },
      `SQL ${event.query.replace(/"public"\./g, '')}`,
    );
  });
}
