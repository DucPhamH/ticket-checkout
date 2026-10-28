import { randomBytes } from 'node:crypto';
import { callVnpayApi, signPipeJoined, type VnpayApiMessage } from './vnpay.api';
import { VNPAY_VERSION } from './vnpay.constants';
import type { VnpayConfig } from './vnpay.config';
import { formatVnpayDate } from './vnpay.date';

/**
 * VNPay "querydr": ask VNPay for the result of a payment ourselves, for when IPN is late or never
 * arrives.
 */

const REQUEST_FIELDS = [
  'vnp_RequestId',
  'vnp_Version',
  'vnp_Command',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_TransactionDate',
  'vnp_CreateDate',
  'vnp_IpAddr',
  'vnp_OrderInfo',
] as const;

// The spec's formula drops a "|" between vnp_Amount and vnp_BankCode; with it restored, VNPay's
// signature verifies (checked against the live sandbox on 2026-10-28).
const RESPONSE_FIELDS = [
  'vnp_ResponseId',
  'vnp_Command',
  'vnp_ResponseCode',
  'vnp_Message',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_Amount',
  'vnp_BankCode',
  'vnp_PayDate',
  'vnp_TransactionNo',
  'vnp_TransactionType',
  'vnp_TransactionStatus',
  'vnp_OrderInfo',
  'vnp_PromotionCode',
  'vnp_PromotionAmount',
] as const;

export type QueryDrResponse = VnpayApiMessage;

export function signQueryDrResponse(response: QueryDrResponse, secret: string): string {
  return signPipeJoined(secret, RESPONSE_FIELDS, response);
}

/**
 * Asks VNPay about one payment. `transactionDate` is the vnp_CreateDate we sent when creating it.
 * Throws if VNPay cannot be reached or its answer is not signed with our secret.
 */
export function queryVnpayTransaction(
  input: { txnRef: string; transactionDate: Date },
  config: VnpayConfig,
): Promise<QueryDrResponse> {
  const request = {
    vnp_RequestId: randomBytes(16).toString('hex'), // unique per day
    vnp_Version: VNPAY_VERSION,
    vnp_Command: 'querydr',
    vnp_TmnCode: config.tmnCode,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: `Truy van giao dich ${input.txnRef}`,
    vnp_TransactionDate: formatVnpayDate(input.transactionDate),
    vnp_CreateDate: formatVnpayDate(new Date()),
    vnp_IpAddr: '127.0.0.1', // the server making the query
  };
  return callVnpayApi(request, { request: REQUEST_FIELDS, response: RESPONSE_FIELDS }, config);
}
