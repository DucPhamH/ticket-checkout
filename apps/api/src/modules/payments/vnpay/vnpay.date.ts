import { VNPAY_UTC_OFFSET_HOURS } from './vnpay.constants';

const pad = (n: number) => String(n).padStart(2, '0');

// 2026-10-28T03:04:05Z -> "20261028100405" (the same instant in GMT+7).
export function formatVnpayDate(date: Date): string {
  const local = new Date(date.getTime() + VNPAY_UTC_OFFSET_HOURS * 3_600_000);
  return (
    local.getUTCFullYear() +
    pad(local.getUTCMonth() + 1) +
    pad(local.getUTCDate()) +
    pad(local.getUTCHours()) +
    pad(local.getUTCMinutes()) +
    pad(local.getUTCSeconds())
  );
}
