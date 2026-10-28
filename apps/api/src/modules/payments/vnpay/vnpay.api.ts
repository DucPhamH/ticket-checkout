import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VnpayConfig } from './vnpay.config';

/**
 * VNPay's server-to-server API (querydr, refund): one endpoint, POST JSON. Unlike the payment URL,
 * the checksum is the field values joined with "|" in a fixed order per command (not sorted).
 * Spec: sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html
 */

export type VnpayApiMessage = Record<string, string>;

export function signPipeJoined(secret: string, fields: readonly string[], values: Record<string, string | undefined>) {
  return createHmac('sha512', secret)
    .update(fields.map((field) => values[field] ?? '').join('|'), 'utf8')
    .digest('hex');
}

/**
 * Sends a request signed over `requestFields` and returns the response once its signature over
 * `responseFields` checks out. Throws if VNPay cannot be reached or the answer is not signed with
 * our secret (an unsigned answer cannot be trusted, whatever it says).
 */
export async function callVnpayApi(
  request: VnpayApiMessage,
  fields: { request: readonly string[]; response: readonly string[] },
  config: VnpayConfig,
): Promise<VnpayApiMessage> {
  const body = { ...request, vnp_SecureHash: signPipeJoined(config.hashSecret, fields.request, request) };

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`VNPay ${request.vnp_Command} answered HTTP ${res.status}`);
  const response = (await res.json()) as VnpayApiMessage;

  const received = response.vnp_SecureHash?.toLowerCase() ?? '';
  const expected = signPipeJoined(config.hashSecret, fields.response, response);
  if (
    !/^[0-9a-f]{128}$/.test(received) ||
    !timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  ) {
    // The code is untrusted here, but it tells a human where to look (e.g. 97 = our checksum was wrong).
    throw new Error(
      `VNPay ${request.vnp_Command} response has an invalid signature (vnp_ResponseCode ${response.vnp_ResponseCode ?? '?'})`,
    );
  }
  return response;
}
