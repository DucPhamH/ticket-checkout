import { prisma } from '../../db/prisma';
import { PaymentNotificationSource } from '../../generated/prisma/enums';
import { logger } from '../../lib/logger';
import { IPN_RESPONSE, type IpnResponse } from './payments.constants';
import { settleGatewayResult } from './payments.settlement';
import { getVnpayConfig } from './vnpay/vnpay.config';
import { isVnpaySuccess } from './vnpay/vnpay.result';
import { verifyVnpaySignature, type VnpayParams } from './vnpay/vnpay.signature';

type Outcome = { response: IpnResponse; signatureValid: boolean; paymentId: number | null };

/**
 * VNPay's server-to-server notification: the source of truth for a payment's result.
 *
 * Checks, in VNPay's order: input (99), signature (97), payment exists (01), amount (04),
 * not processed yet (02). Then settles the payment and the order, and posts to the ledger,
 * all in one transaction. Every call is recorded in payment_notifications, whatever happens.
 * An unexpected error answers 99 so VNPay retries later.
 */
export async function handleVnpayIpn(params: VnpayParams): Promise<IpnResponse> {
  let outcome: Outcome;
  try {
    outcome = await processIpn(params);
  } catch (err) {
    logger.error({ err, txnRef: params.vnp_TxnRef }, 'vnpay ipn failed; VNPay will retry');
    outcome = { response: IPN_RESPONSE.unknownError, signatureValid: false, paymentId: null };
  }
  await recordNotification(params, outcome);
  logger.info({ txnRef: params.vnp_TxnRef, rspCode: outcome.response.RspCode }, 'vnpay ipn');
  return outcome.response;
}

async function processIpn(params: VnpayParams): Promise<Outcome> {
  if (!params.vnp_TxnRef || !params.vnp_SecureHash || !params.vnp_Amount) {
    return { response: IPN_RESPONSE.inputRequired, signatureValid: false, paymentId: null };
  }
  if (!verifyVnpaySignature(params, getVnpayConfig().hashSecret)) {
    return { response: IPN_RESPONSE.invalidSignature, signatureValid: false, paymentId: null };
  }

  const found = await prisma.payment.findUnique({
    where: { txnRef: params.vnp_TxnRef },
    select: { id: true, orderId: true },
  });
  if (!found) return { response: IPN_RESPONSE.orderNotFound, signatureValid: true, paymentId: null };

  const outcome = await settleGatewayResult(
    { paymentId: found.id, orderId: found.orderId },
    {
      success: isVnpaySuccess(params),
      amount: params.vnp_Amount,
      responseCode: params.vnp_ResponseCode ?? null,
      transactionNo: params.vnp_TransactionNo ?? null,
      payDate: params.vnp_PayDate ?? null,
      bankCode: params.vnp_BankCode ?? null,
    },
  );
  const response = {
    applied: IPN_RESPONSE.success,
    alreadyApplied: IPN_RESPONSE.alreadyConfirmed,
    amountMismatch: IPN_RESPONSE.invalidAmount,
  }[outcome];
  return { response, signatureValid: true, paymentId: found.id };
}

// Recorded outside the processing transaction, so it is kept even when processing rolled back.
async function recordNotification(params: VnpayParams, outcome: Outcome) {
  try {
    await prisma.paymentNotification.create({
      data: {
        paymentId: outcome.paymentId,
        source: PaymentNotificationSource.IPN,
        payload: params,
        signatureValid: outcome.signatureValid,
        result: outcome.response.RspCode,
      },
    });
  } catch (err) {
    logger.error({ err, txnRef: params.vnp_TxnRef }, 'could not record vnpay ipn');
  }
}
