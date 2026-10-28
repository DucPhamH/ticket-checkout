import type { SupportedLocale } from '@tc/shared';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { PaymentNotificationSource } from '../../generated/prisma/enums';
import { logger } from '../../lib/logger';
import { RETURN_RESULT } from './payments.constants';
import { reconcilePayment } from './payments.reconcile';
import { getVnpayConfig } from './vnpay/vnpay.config';
import { isVnpaySuccess } from './vnpay/vnpay.result';
import { verifyVnpaySignature, type VnpayParams } from './vnpay/vnpay.signature';

/**
 * The buyer's browser coming back from VNPay. Per VNPay's spec the query string only gets verified
 * and recorded: it never changes the order or the payment (the browser can be closed, replayed or
 * tampered with). If IPN has not settled the payment yet, we ask VNPay ourselves (querydr) and apply
 * its answer, so the buyer usually lands on a final status even when IPN is late or missing.
 *
 * Returns the URL to redirect to. It is built only from our own config and ids from our database,
 * never from the query, so this endpoint cannot be used to redirect people elsewhere.
 */
export async function handleVnpayReturn(params: VnpayParams, locale: SupportedLocale): Promise<string> {
  const home = `${env.WEB_PUBLIC_URL}/${locale}`;
  const txnRef = params.vnp_TxnRef;
  if (!txnRef) return home; // not a VNPay redirect at all: nothing worth recording

  const signatureValid = verifyVnpaySignature(params, getVnpayConfig().hashSecret);
  const payment = await prisma.payment.findUnique({
    where: { txnRef },
    select: { id: true, orderId: true, providerResponseCode: true },
  });

  const result = !signatureValid
    ? RETURN_RESULT.invalidSignature
    : !payment
      ? RETURN_RESULT.unknownPayment
      : isVnpaySuccess(params)
        ? RETURN_RESULT.reportedSuccess
        : RETURN_RESULT.reportedFailure;

  // Stored raw, before anything else, as the audit trail of what the gateway (or someone) sent.
  await prisma.paymentNotification.create({
    data: {
      paymentId: payment?.id ?? null,
      source: PaymentNotificationSource.RETURN,
      payload: params,
      signatureValid,
      result,
    },
  });

  logger.info(
    { txnRef, result, responseCode: params.vnp_ResponseCode, transactionStatus: params.vnp_TransactionStatus },
    'vnpay return',
  );

  // The query string is never trusted to change anything. If IPN has not settled the payment yet,
  // ask VNPay directly (querydr): its signed server-to-server answer is trusted, like an IPN.
  if (signatureValid && payment && payment.providerResponseCode === null) {
    await reconcilePayment(payment.id);
  }

  // The order page shows the status from the database, whatever the query claimed.
  return payment ? `${home}/orders/${payment.orderId}` : home;
}
