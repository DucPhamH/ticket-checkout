// VNPay payment API 2.1.0. Spec: sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
export const VNPAY_VERSION = '2.1.0';
export const VNPAY_COMMAND_PAY = 'pay';
export const VNPAY_CURRENCY = 'VND';
export const VNPAY_ORDER_TYPE = 'other';

// VNPay amounts have no decimal point: 10,000 VND is sent as 1000000.
export const VNPAY_AMOUNT_MULTIPLIER = 100;

// Dates are yyyyMMddHHmmss in Vietnam time (GMT+7).
export const VNPAY_UTC_OFFSET_HOURS = 7;

export const VNPAY_ORDER_INFO_MAX_LENGTH = 255;

// Never part of the signed data, and 2.1.0 does not send SecureHashType at all.
export const VNPAY_SIGNATURE_FIELDS = ['vnp_SecureHash', 'vnp_SecureHashType'] as const;
