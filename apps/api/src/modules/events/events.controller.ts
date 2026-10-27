import type { RequestHandler } from 'express';
import { toEventSummaryDto } from './events.mapper';
import { listActiveEvents } from './events.service';

export const getEvents: RequestHandler = async (_req, res) => {
  const rows = await listActiveEvents();
  res.json(rows.map(({ event, stats }) => toEventSummaryDto(event, stats)));
};
