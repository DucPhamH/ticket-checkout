import type { VnpayParams } from './vnpay.signature';

// VNPay reports success only when both codes are "00" (ResponseCode alone is not enough).
export function isVnpaySuccess(params: VnpayParams): boolean {
  return params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
}
