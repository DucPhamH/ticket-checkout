import { prisma } from '../../db/prisma';
import { OrderStatus, RefundStatus } from '../../generated/prisma/enums';
import { HttpError } from '../../lib/http-error';
import { logger } from '../../lib/logger';
import { refundCompletedPosting } from '../ledger/ledger.postings';
import { postTransaction } from '../ledger/ledger.service';
import { getVnpayConfig } from './vnpay/vnpay.config';
import { requestVnpayRefund, type RefundResponse } from './vnpay/vnpay.refund';

export type RefundOutcome = 'SUCCEEDED' | 'FAILED' | 'ALREADY_SUCCEEDED';

// Longer than the 10 s VNPay call it waits on, so the transaction never times out first.
const REFUND_TRANSACTION_TIMEOUT_MS = 20_000;

/**
 * Sends one refund to VNPay and records the result. Safe to call again: a refund that succeeded
 * is never sent twice, and a failed one can simply be retried.
 *
 * The refund row stays locked (FOR UPDATE) while VNPay answers, so two retries clicked at the same
 * time cannot both send it: the second waits, then sees SUCCEEDED. If the process died after VNPay
 * accepted but before we committed, a retry would get 94 ("already requested") and stay FAILED for
 * a human to check in VNPay's merchant portal; nothing is refunded twice.
 */
export async function processRefund(refundId: number, createdBy = 'admin'): Promise<RefundOutcome> {
  const outcome = await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM refunds WHERE id = ${refundId} FOR UPDATE`;
      if (locked.length === 0) throw HttpError.notFound('REFUND_NOT_FOUND', `No refund with id ${refundId}`);
      const refund = await tx.refund.findUniqueOrThrow({
        where: { id: refundId },
        include: { payment: true, order: { select: { buyerId: true, createdAt: true } } },
      });
      if (refund.status === RefundStatus.SUCCEEDED) return 'ALREADY_SUCCEEDED';

      let response: RefundResponse | null = null;
      let error: string | null = null;
      try {
        response = await requestVnpayRefund(
          {
            txnRef: refund.payment.txnRef,
            amountVnd: refund.amount,
            transactionNo: refund.payment.providerTransactionNo,
            transactionDate: refund.order.createdAt, // the vnp_CreateDate of the payment URL
            createdBy,
            orderId: refund.orderId,
          },
          getVnpayConfig(),
        );
        if (response.vnp_ResponseCode !== '00') {
          error = `VNPay refused: ${response.vnp_ResponseCode} ${response.vnp_Message ?? ''}`.trim();
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      const attempt = { attempts: { increment: 1 }, providerResponse: response ?? undefined };
      if (error !== null) {
        await tx.refund.update({
          where: { id: refund.id },
          data: { ...attempt, status: RefundStatus.FAILED, lastError: error },
        });
        return 'FAILED';
      }

      await tx.refund.update({
        where: { id: refund.id },
        data: { ...attempt, status: RefundStatus.SUCCEEDED, lastError: null, completedAt: new Date() },
      });
      await tx.order.update({ where: { id: refund.orderId }, data: { status: OrderStatus.REFUNDED } });
      await postTransaction(tx, refundCompletedPosting(refund, refund.order.buyerId));
      return 'SUCCEEDED';
    },
    { timeout: REFUND_TRANSACTION_TIMEOUT_MS },
  );

  logger[outcome === 'FAILED' ? 'warn' : 'info']({ refundId, outcome }, 'vnpay refund');
  return outcome;
}
