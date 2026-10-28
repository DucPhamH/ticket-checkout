import { z } from 'zod';
import { env } from '../../../config/env';

export type VnpayConfig = {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
};

const schema = z.object({
  VNP_TMN_CODE: z
    .string({ error: 'VNP_TMN_CODE is missing' })
    .regex(/^[A-Za-z0-9]{8}$/, 'VNP_TMN_CODE must be the 8-character terminal code from VNPay'),
  VNP_HASH_SECRET: z.string({ error: 'VNP_HASH_SECRET is missing' }).min(1, 'VNP_HASH_SECRET is empty'),
  VNP_PAY_URL: z.url(),
});

/**
 * VNPay credentials, validated. Throws with every problem listed.
 * The server calls this before it starts listening (index.ts), so a missing or malformed
 * credential stops it at startup instead of failing the first buyer.
 */
export function getVnpayConfig(source: Record<string, unknown> = env): VnpayConfig {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
    throw new Error(`VNPay is not configured correctly. Fix .env (see .env.example):\n${problems}`);
  }
  return {
    tmnCode: result.data.VNP_TMN_CODE,
    hashSecret: result.data.VNP_HASH_SECRET,
    payUrl: result.data.VNP_PAY_URL,
  };
}
