import type { RequestHandler } from 'express';
import type { AdminEventDto, Page, RefundDto } from '@tc/shared';
import { requireCurrentUser } from '../../middlewares/current-user';
import { processRefund } from '../payments/payments.refund';
import { cancelEvent } from '../events/event-cancellation';
import { completeEvent } from '../events/event-completion';
import { EventIdParamsSchema } from '../events/events.schema';
import { getTrialBalance } from '../ledger/ledger.balances';
import { toCancelEventResultDto, toCompleteEventResultDto, toRefundDto, toTrialBalanceDto } from './admin.mapper';
import { AdminEventsQuerySchema, RefundIdParamsSchema, RefundsQuerySchema } from './admin.schema';
import { findRefund, listEventsForAdmin, listRefunds } from './admin.service';

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

export const getAdminRefunds: RequestHandler = async (req, res) => {
  const { limit, cursor } = RefundsQuerySchema.parse(req.query);
  res.json((await listRefunds({ limit, afterId: cursor?.id })) satisfies Page<RefundDto>);
};

// Sends (or re-sends) one refund to VNPay and answers with the refund as it now stands.
export const postRetryRefund: RequestHandler = async (req, res) => {
  const { id } = RefundIdParamsSchema.parse(req.params);
  await processRefund(id, `admin-${requireCurrentUser(req).id}`);
  res.json(toRefundDto(await findRefund(id)));
};

export const postCancelEvent: RequestHandler = async (req, res) => {
  const { id } = EventIdParamsSchema.parse(req.params);
  res.json(toCancelEventResultDto(await cancelEvent(id, `admin-${requireCurrentUser(req).id}`)));
};
