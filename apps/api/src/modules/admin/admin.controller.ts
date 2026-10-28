import type { RequestHandler } from 'express';
import type { AdminEventDto, Page } from '@tc/shared';
import { completeEvent } from '../events/event-completion';
import { EventIdParamsSchema } from '../events/events.schema';
import { getTrialBalance } from '../ledger/ledger.balances';
import { toCompleteEventResultDto, toTrialBalanceDto } from './admin.mapper';
import { AdminEventsQuerySchema } from './admin.schema';
import { listEventsForAdmin } from './admin.service';

export const getAdminTrialBalance: RequestHandler = async (_req, res) => {
  res.json(toTrialBalanceDto(await getTrialBalance()));
};

export const getAdminEvents: RequestHandler = async (req, res) => {
  const page = AdminEventsQuerySchema.parse(req.query);
  res.json((await listEventsForAdmin(page)) satisfies Page<AdminEventDto>);
};

export const postCompleteEvent: RequestHandler = async (req, res) => {
  const { id } = EventIdParamsSchema.parse(req.params);
  res.json(toCompleteEventResultDto(await completeEvent(id)));
};
