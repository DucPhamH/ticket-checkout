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
  // VNPay sandbox. Validated when the server starts (see getVnpayConfig), not here, so the seed
  // and migrations run without them.
  VNP_TMN_CODE: z.string().optional(),
  VNP_HASH_SECRET: z.string().optional(),
  VNP_PAY_URL: z.url().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNP_API_URL: z.url().default('https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'),
});

export const env = schema.parse(process.env);
