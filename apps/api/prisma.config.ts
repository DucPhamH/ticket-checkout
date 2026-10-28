import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer loads .env itself. Use the repo-root .env when it exists (local dev);
// in Docker the variables come from compose.
dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/db/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
