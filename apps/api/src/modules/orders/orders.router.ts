import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { getMyOrders, getOrder, postOrder } from './orders.controller';

export const ordersRouter = Router();

ordersRouter.post('/orders', currentUser, postOrder);
ordersRouter.get('/orders/:id', currentUser, getOrder);
ordersRouter.get('/me/orders', currentUser, getMyOrders);
