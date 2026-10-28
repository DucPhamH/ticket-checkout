import type { Request, RequestHandler } from 'express';
import { handleVnpayReturn } from './payments.return';
import { ReturnParamsSchema } from './payments.schema';
import type { VnpayParams } from './vnpay/vnpay.signature';

// Keeps single string values only (a repeated parameter is not something VNPay sends).
function stringParams(query: Request['query']): VnpayParams {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export const getVnpayReturn: RequestHandler = async (req, res) => {
  const { locale } = ReturnParamsSchema.parse(req.params);
  res.redirect(302, await handleVnpayReturn(stringParams(req.query), locale));
};
