import { env } from './config/env';
import { createApp } from './app';
import { startOrderExpiryJob } from './jobs/order-expiry.job';
import { logger } from './lib/logger';
import { getVnpayConfig } from './modules/payments/vnpay/vnpay.config';

// Fail fast: refuse to start without valid payment credentials rather than fail the first buyer.
try {
  getVnpayConfig();
} catch (error) {
  logger.fatal((error as Error).message);
  process.exit(1);
}

createApp().listen(env.PORT, () => {
  logger.info(`api listening on :${env.PORT}`);
});

// Background jobs live in the server process only, never in tests (which import createApp).
startOrderExpiryJob();
