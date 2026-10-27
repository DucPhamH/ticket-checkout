import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the repo-root .env when running outside Docker. In Docker, compose
// injects the variables and this file does not exist, which dotenv ignores.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Print every SQL statement Prisma runs (debugging only).
  LOG_SQL: z.stringbool().default(false),
  DATABASE_URL: z.string().min(1),
  WEB_PUBLIC_URL: z.url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
});

export const env = schema.parse(process.env);
