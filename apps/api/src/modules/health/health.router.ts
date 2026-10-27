import { Router } from 'express';
import { getHealth } from './health.service';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  res.json(await getHealth());
});
