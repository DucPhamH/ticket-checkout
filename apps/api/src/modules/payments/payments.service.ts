import { randomBytes } from 'node:crypto';
import type { SupportedLocale } from '@tc/shared';
import { env } from '../../config/env';
import type { Order, Payment, Prisma } from '../../generated/prisma/client';
import { toNumber } from '../../lib/money';
import { getVnpayConfig } from './vnpay/vnpay.config';
import { buildVnpayPaymentUrl } from './vnpay/vnpay.payment-url';

/**
 * Our reference for the payment at VNPay (vnp_TxnRef). It must not repeat within a day, and
 * order ids restart after a database reset while VNPay remembers old references, so the order
 * id alone is not enough: "72T" + time in base 36 + random, e.g. "72Tmh8x3k2fa9c1".
 */
export function newTxnRef(orderId: number): string {
  return `${orderId}T${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}

// Opens the gateway side of a new order. Runs inside the order transaction.
export function createPaymentForOrder(tx: Prisma.TransactionClient, order: Pick<Order, 'id' | 'total'>) {
  return tx.payment.create({
    data: { orderId: order.id, txnRef: newTxnRef(order.id), amount: order.total },
  });
}

const VNPAY_LOCALE: Record<SupportedLocale, 'vn' | 'en'> = { vi: 'vn', en: 'en' };

type PaymentUrlContext = { ipAddr: string; locale: SupportedLocale };

// The signed URL the buyer's browser is sent to.
export function paymentUrlFor(
  order: Pick<Order, 'id' | 'total' | 'createdAt' | 'expiresAt'>,
  payment: Pick<Payment, 'txnRef'>,
  { ipAddr, locale }: PaymentUrlContext,
): string {
  return buildVnpayPaymentUrl(
    {
      txnRef: payment.txnRef,
      amountVnd: toNumber(order.total),
      orderInfo: `Thanh toan don hang ${order.id}`,
      ipAddr,
      locale: VNPAY_LOCALE[locale],
      // The locale travels in the path so the buyer lands back on the page in their language.
      returnUrl: `${env.API_PUBLIC_URL}/payments/vnpay/return/${locale}`,
      createdAt: order.createdAt,
      // Same instant the ticket reservation ends: VNPay refuses payment after it.
      expiresAt: order.expiresAt,
    },
    getVnpayConfig(),
  );
}
