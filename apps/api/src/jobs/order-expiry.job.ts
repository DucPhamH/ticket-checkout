import { ORDER_EXPIRY_SWEEP_SECONDS } from '../constants/orders';
import { logger } from '../lib/logger';
import { expireAllStaleOrders } from '../modules/orders/order-expiry';

// Releases tickets held by unpaid orders, once at startup and then on an interval.
// Runs inside the api process; with several api instances each runs it, which is safe
// because expiring is idempotent.
export function startOrderExpiryJob(): () => void {
  let running = false;

  async function sweep() {
    if (running) return; // a slow sweep is still going; skip this tick rather than pile up
    running = true;
    try {
      const count = await expireAllStaleOrders();
      if (count > 0) logger.info({ count }, `expired ${count} unpaid order(s) and released their tickets`);
    } catch (err) {
      logger.error({ err }, 'order expiry sweep failed');
    } finally {
      running = false;
    }
  }

  void sweep();
  const timer = setInterval(() => void sweep(), ORDER_EXPIRY_SWEEP_SECONDS * 1000);
  timer.unref(); // never keep the process alive just for this timer
  return () => clearInterval(timer);
}
