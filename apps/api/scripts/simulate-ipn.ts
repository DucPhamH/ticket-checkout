/**
 * Plays VNPay's part: sends the running api a signed IPN for an order, as VNPay would after the
 * buyer pays. Lets you test IPN handling locally before VNPay can reach this machine.
 *
 *   npm run vnpay:simulate-ipn -w @tc/api -- <orderId> [responseCode]
 *
 * responseCode defaults to 00 (success); try 24 (buyer cancelled) or 51 (insufficient funds).
 * Uses the real VNP_HASH_SECRET from .env and sends to API_PUBLIC_URL.
 */
import { env } from '../src/config/env';
import { prisma } from '../src/db/prisma';
import { getVnpayConfig } from '../src/modules/payments/vnpay/vnpay.config';
import { formatVnpayDate } from '../src/modules/payments/vnpay/vnpay.date';
import { toVnpayOrderInfo } from '../src/modules/payments/vnpay/vnpay.order-info';
import { signVnpayParams } from '../src/modules/payments/vnpay/vnpay.signature';

async function main() {
  const [orderIdArg, responseCode = '00'] = process.argv.slice(2);
  const orderId = Number(orderIdArg);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new Error('Usage: npm run vnpay:simulate-ipn -w @tc/api -- <orderId> [responseCode]');
  }

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) throw new Error(`Order ${orderId} has no payment`);
  const config = getVnpayConfig();

  const fields: Record<string, string> = {
    vnp_Amount: String(payment.amount * 100n),
    vnp_BankCode: 'NCB',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: toVnpayOrderInfo(`Thanh toan don hang ${orderId}`),
    vnp_PayDate: formatVnpayDate(new Date()),
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: config.tmnCode,
    vnp_TransactionNo: String(Math.floor(10_000_000 + Math.random() * 89_999_999)),
    vnp_TransactionStatus: responseCode === '00' ? '00' : '02',
    vnp_TxnRef: payment.txnRef,
  };
  const query = new URLSearchParams({ ...fields, vnp_SecureHash: signVnpayParams(fields, config.hashSecret) });
  const url = `${env.API_PUBLIC_URL}/payments/vnpay/ipn?${query}`;

  console.log(`→ IPN for order ${orderId} (${payment.txnRef}), vnp_ResponseCode=${responseCode}`);
  const res = await fetch(url);
  console.log(`← HTTP ${res.status}`, await res.json());

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  console.log(`  order ${orderId} is now ${order.status}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
