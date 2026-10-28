import { Router } from 'express';
import { getVnpayIpn, getVnpayReturn } from './payments.controller';

export const paymentsRouter = Router();

// No currentUser: VNPay sends the browser here, the buyer is identified by the payment reference.
paymentsRouter.get('/payments/vnpay/return/:locale', getVnpayReturn);

// Called by VNPay's servers (not the browser). Must be reachable over HTTPS: see docs/running.md.
paymentsRouter.get('/payments/vnpay/ipn', getVnpayIpn);
