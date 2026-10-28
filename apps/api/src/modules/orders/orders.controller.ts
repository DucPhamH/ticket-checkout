import type { RequestHandler } from 'express';
import type { CreateOrderResponse } from '@tc/shared';
import { HttpError } from '../../lib/http-error';
import { clientIp } from '../../lib/client-ip';
import { requireCurrentUser } from '../../middlewares/current-user';
import { paymentUrlFor } from '../payments/payments.service';
import { toOrderDto } from './orders.mapper';
import { CreateOrderBodySchema, OrderIdParamsSchema } from './orders.schema';
import { createOrder, findOrderForBuyer } from './orders.service';

export const postOrder: RequestHandler = async (req, res) => {
  const input = CreateOrderBodySchema.parse(req.body);
  const { order, payment } = await createOrder(requireCurrentUser(req), input);
  const paymentUrl = paymentUrlFor(order, payment, { ipAddr: clientIp(req), locale: input.locale ?? 'vi' });
  res.status(201).json({ order: toOrderDto(order), paymentUrl } satisfies CreateOrderResponse);
};

export const getOrder: RequestHandler = async (req, res) => {
  const { id } = OrderIdParamsSchema.parse(req.params);
  const order = await findOrderForBuyer(id, requireCurrentUser(req).id);
  if (!order) throw HttpError.notFound('ORDER_NOT_FOUND', `No order with id ${id}`);
  res.json(toOrderDto(order));
};
