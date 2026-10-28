import { createHmac, timingSafeEqual } from 'node:crypto';
import { VNPAY_SIGNATURE_FIELDS } from './vnpay.constants';

export type VnpayParams = Record<string, string>;

/**
 * Encodes one value the way VNPay's samples do (PHP urlencode, Java URLEncoder, Node
 * encodeURIComponent + "%20" -> "+"): percent-encoding, with spaces as "+".
 * Characters the samples disagree on (! ' ( ) * ~) are kept out of our values instead.
 */
export function encodeVnpayValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

/**
 * The exact string that gets signed: every vnp_ field except the signature itself,
 * sorted by name, values encoded, joined as k=v&k=v. The same string is the URL query.
 */
export function buildSignData(params: VnpayParams): string {
  return Object.keys(params)
    .filter((key) => !(VNPAY_SIGNATURE_FIELDS as readonly string[]).includes(key))
    .sort()
    .map((key) => `${key}=${encodeVnpayValue(params[key])}`)
    .join('&');
}

// HMAC-SHA512 of the sign data with the merchant's secret, as lowercase hex.
export function signVnpayParams(params: VnpayParams, hashSecret: string): string {
  return createHmac('sha512', hashSecret).update(buildSignData(params), 'utf8').digest('hex');
}

/**
 * Checks the vnp_SecureHash VNPay sent back (Return URL and IPN). `params` are the decoded
 * query parameters. Compared in constant time so the check leaks nothing about the secret.
 */
export function verifyVnpaySignature(params: VnpayParams, hashSecret: string): boolean {
  const received = params.vnp_SecureHash?.toLowerCase();
  if (!received || !/^[0-9a-f]{128}$/.test(received)) return false;
  const expected = signVnpayParams(params, hashSecret);
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
}
