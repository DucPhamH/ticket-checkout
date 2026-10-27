import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/http-error';
import { toEventDetailDto, toEventSummaryDto } from './events.mapper';
import { EventIdParamsSchema } from './events.schema';
import { findEventWithListings, listActiveEvents } from './events.service';

export const getEvents: RequestHandler = async (_req, res) => {
  const rows = await listActiveEvents();
  res.json(rows.map(({ event, stats }) => toEventSummaryDto(event, stats)));
};

export const getEvent: RequestHandler = async (req, res) => {
  // Invalid ids throw a ZodError, which the error handler turns into 400 VALIDATION_ERROR.
  const { id } = EventIdParamsSchema.parse(req.params);
  const event = await findEventWithListings(id);
  if (!event) throw HttpError.notFound('EVENT_NOT_FOUND', `No event with id ${id}`);
  res.json(toEventDetailDto(event));
};
