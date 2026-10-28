/**
 * Asks VNPay for an order's payment result (querydr) and applies it, exactly as an IPN would.
 * For payments whose IPN never arrived.
 *
 *   npm run vnpay:reconcile -w @tc/api -- <orderId>
 */
import { prisma } from '../src/db/prisma';
import { reconcilePayment } from '../src/modules/payments/payments.reconcile';

async function main() {
  const orderId = Number(process.argv[2]);
  if (!Number.isSafeInteger(orderId) || orderId <= 0)
    throw new Error('Usage: npm run vnpay:reconcile -w @tc/api -- <orderId>');
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) throw new Error(`Order ${orderId} has no payment`);

  const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const outcome = await reconcilePayment(payment.id);
  const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  console.log(`order ${orderId}: ${before.status} → ${after.status} (querydr: ${outcome})`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
