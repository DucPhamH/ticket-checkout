import { VNPAY_ORDER_INFO_MAX_LENGTH } from './vnpay.constants';

/**
 * VNPay wants the description in Vietnamese without diacritics and without special characters.
 * "Đơn #72 – Hà Nội!" -> "Don 72 Ha Noi"
 */
export function toVnpayOrderInfo(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop accents (combining marks)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, VNPAY_ORDER_INFO_MAX_LENGTH);
}
