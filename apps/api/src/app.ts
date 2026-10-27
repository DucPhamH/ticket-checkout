import express from 'express';
import { errorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { healthRouter } from './modules/health/health.router';

// Builds the Express app without listening, so tests can call it directly.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
