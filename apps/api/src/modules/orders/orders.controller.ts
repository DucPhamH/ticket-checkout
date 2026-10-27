import type { RequestHandler } from 'express';
import { HttpError } from '../../lib/http-error';
import { requireCurrentUser } from '../../middlewares/current-user';
import { toOrderDto } from './orders.mapper';
import { CreateOrderBodySchema, OrderIdParamsSchema } from './orders.schema';
import { createOrder, findOrderForBuyer } from './orders.service';

export const postOrder: RequestHandler = async (req, res) => {
  const input = CreateOrderBodySchema.parse(req.body);
  const order = await createOrder(requireCurrentUser(req), input);
  res.status(201).json(toOrderDto(order));
};

export const getOrder: RequestHandler = async (req, res) => {
  const { id } = OrderIdParamsSchema.parse(req.params);
  const order = await findOrderForBuyer(id, requireCurrentUser(req).id);
  if (!order) throw HttpError.notFound('ORDER_NOT_FOUND', `No order with id ${id}`);
  res.json(toOrderDto(order));
};
