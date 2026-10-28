import type { RequestHandler } from 'express';
import type { CreateOrderResponse, OrderDto, Page } from '@tc/shared';
import { HttpError } from '../../lib/http-error';
import { clientIp } from '../../lib/client-ip';
import { requireCurrentUser } from '../../middlewares/current-user';
import { reconcileIfDue } from '../payments/payments.reconcile';
import { paymentUrlFor } from '../payments/payments.service';
import { toOrderDto } from './orders.mapper';
import { CreateOrderBodySchema, MyOrdersQuerySchema, OrderIdParamsSchema } from './orders.schema';
import { createOrder, findOrderForBuyer, listOrdersForBuyer } from './orders.service';

export const postOrder: RequestHandler = async (req, res) => {
  const input = CreateOrderBodySchema.parse(req.body);
  const { order, payment } = await createOrder(requireCurrentUser(req), input);
  const paymentUrl = paymentUrlFor(order, payment, { ipAddr: clientIp(req), locale: input.locale ?? 'vi' });
  res.status(201).json({ order: toOrderDto(order), paymentUrl } satisfies CreateOrderResponse);
};

export const getOrder: RequestHandler = async (req, res) => {
  const { id } = OrderIdParamsSchema.parse(req.params);
  const buyerId = requireCurrentUser(req).id;
  let order = await findOrderForBuyer(id, buyerId);
  if (!order) throw HttpError.notFound('ORDER_NOT_FOUND', `No order with id ${id}`);
  if (order.status === 'PENDING') {
    // The buyer is waiting on the order page: if IPN is late, ask VNPay (throttled), then re-read.
    await reconcileIfDue(order.id);
    order = (await findOrderForBuyer(id, buyerId)) ?? order;
  }
  res.json(toOrderDto(order));
};

export const getMyOrders: RequestHandler = async (req, res) => {
  const page = MyOrdersQuerySchema.parse(req.query);
  res.json((await listOrdersForBuyer(requireCurrentUser(req).id, page)) satisfies Page<OrderDto>);
};
