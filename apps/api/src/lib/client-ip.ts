import type { Request } from 'express';

const FALLBACK_IP = '127.0.0.1';

/**
 * The buyer's IP, which VNPay requires (vnp_IpAddr, 7–45 characters).
 * The browser never calls the api directly: web forwards the buyer's address in X-Forwarded-For.
 * It is informational for VNPay (risk checks), not used for any decision here.
 */
export function clientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return normalizeIp(forwarded || req.socket.remoteAddress || FALLBACK_IP);
}

export function normalizeIp(ip: string): string {
  if (ip === '::1') return FALLBACK_IP; // IPv6 localhost is too short for VNPay
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4 written as IPv6
  const value = mapped ? mapped[1] : ip;
  return value.length >= 7 && value.length <= 45 ? value : FALLBACK_IP;
}
