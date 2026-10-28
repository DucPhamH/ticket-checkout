import { env } from './config/env';
import { createApp } from './app';
import { startOrderExpiryJob } from './jobs/order-expiry.job';
import { logger } from './lib/logger';

createApp().listen(env.PORT, () => {
  logger.info(`api listening on :${env.PORT}`);
});

// Background jobs live in the server process only, never in tests (which import createApp).
startOrderExpiryJob();
