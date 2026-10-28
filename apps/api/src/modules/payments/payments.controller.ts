import type { Request, RequestHandler } from 'express';
import { handleVnpayIpn } from './payments.ipn';
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

// Always HTTP 200 with { RspCode, Message }: VNPay reads the code, not the HTTP status.
export const getVnpayIpn: RequestHandler = async (req, res) => {
  res.status(200).json(await handleVnpayIpn(stringParams(req.query)));
};
