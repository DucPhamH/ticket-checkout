import { Router } from 'express';
import { getVnpayReturn } from './payments.controller';

export const paymentsRouter = Router();

// No currentUser: VNPay sends the browser here, the buyer is identified by the payment reference.
paymentsRouter.get('/payments/vnpay/return/:locale', getVnpayReturn);
