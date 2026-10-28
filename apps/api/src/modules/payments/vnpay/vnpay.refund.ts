import { randomBytes } from 'node:crypto';
import { callVnpayApi, signPipeJoined, type VnpayApiMessage } from './vnpay.api';
import { VNPAY_AMOUNT_MULTIPLIER, VNPAY_VERSION } from './vnpay.constants';
import type { VnpayConfig } from './vnpay.config';
import { formatVnpayDate } from './vnpay.date';

/** VNPay "refund": give a captured payment back to the buyer (we only do full refunds). */

const REQUEST_FIELDS = [
  'vnp_RequestId',
  'vnp_Version',
  'vnp_Command',
  'vnp_TmnCode',
  'vnp_TransactionType',
  'vnp_TxnRef',
  'vnp_Amount',
  'vnp_TransactionNo',
  'vnp_TransactionDate',
  'vnp_CreateBy',
  'vnp_CreateDate',
  'vnp_IpAddr',
  'vnp_OrderInfo',
] as const;

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
] as const;

const FULL_REFUND = '02';

export type RefundResponse = VnpayApiMessage;

export function signRefundResponse(response: RefundResponse, secret: string): string {
  return signPipeJoined(secret, RESPONSE_FIELDS, response);
}

export type RefundRequestInput = {
  txnRef: string; // our vnp_TxnRef of the payment
  amountVnd: bigint;
  transactionNo: string | null; // VNPay's number for the payment
  transactionDate: Date; // the vnp_CreateDate we sent when creating the payment
  createdBy: string; // who asked for the refund (shown in VNPay's merchant portal)
  orderId: number;
};

/**
 * Asks VNPay to refund one payment in full. Returns VNPay's signed answer: vnp_ResponseCode 00
 * means the refund was accepted; anything else is a refusal (e.g. 94 already requested,
 * 95 the original payment failed). Throws if VNPay cannot be reached or the answer is unsigned.
 */
export function requestVnpayRefund(input: RefundRequestInput, config: VnpayConfig): Promise<RefundResponse> {
  const request = {
    vnp_RequestId: randomBytes(16).toString('hex'), // unique per day
    vnp_Version: VNPAY_VERSION,
    vnp_Command: 'refund',
    vnp_TmnCode: config.tmnCode,
    vnp_TransactionType: FULL_REFUND,
    vnp_TxnRef: input.txnRef,
    vnp_Amount: String(input.amountVnd * BigInt(VNPAY_AMOUNT_MULTIPLIER)),
    vnp_TransactionNo: input.transactionNo ?? '',
    vnp_TransactionDate: formatVnpayDate(input.transactionDate),
    vnp_CreateBy: input.createdBy,
    vnp_CreateDate: formatVnpayDate(new Date()),
    vnp_IpAddr: '127.0.0.1', // the server making the request
    vnp_OrderInfo: `Hoan tien don hang ${input.orderId}`,
  };
  return callVnpayApi(request, { request: REQUEST_FIELDS, response: RESPONSE_FIELDS }, config);
}
