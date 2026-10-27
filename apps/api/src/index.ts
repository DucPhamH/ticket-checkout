import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';

createApp().listen(env.PORT, () => {
  logger.info(`api listening on :${env.PORT}`);
});
