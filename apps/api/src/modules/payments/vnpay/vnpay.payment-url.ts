import {
  VNPAY_AMOUNT_MULTIPLIER,
  VNPAY_COMMAND_PAY,
  VNPAY_CURRENCY,
  VNPAY_ORDER_TYPE,
  VNPAY_VERSION,
} from './vnpay.constants';
import type { VnpayConfig } from './vnpay.config';
import { formatVnpayDate } from './vnpay.date';
import { toVnpayOrderInfo } from './vnpay.order-info';
import { buildSignData, signVnpayParams, type VnpayParams } from './vnpay.signature';

export type PaymentUrlInput = {
  txnRef: string; // unique per merchant per day
  amountVnd: number; // what the buyer pays, in VND
  orderInfo: string; // free text; diacritics and symbols are removed
  ipAddr: string; // the buyer's IP
  locale: 'vn' | 'en';
  returnUrl: string; // where VNPay sends the browser back
  createdAt: Date;
  expiresAt: Date; // after this VNPay refuses the payment; we use the reservation end
};

// Builds the signed URL the buyer is redirected to.
export function buildVnpayPaymentUrl(input: PaymentUrlInput, config: VnpayConfig): string {
  const params: VnpayParams = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: VNPAY_COMMAND_PAY,
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(input.amountVnd * VNPAY_AMOUNT_MULTIPLIER),
    vnp_CurrCode: VNPAY_CURRENCY,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: toVnpayOrderInfo(input.orderInfo),
    vnp_OrderType: VNPAY_ORDER_TYPE,
    vnp_Locale: input.locale,
    vnp_ReturnUrl: input.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: formatVnpayDate(input.createdAt),
    vnp_ExpireDate: formatVnpayDate(input.expiresAt),
  };
  const signature = signVnpayParams(params, config.hashSecret);
  // The query is the signed string itself plus the signature, so VNPay sees exactly what we signed.
  return `${config.payUrl}?${buildSignData(params)}&vnp_SecureHash=${signature}`;
}
