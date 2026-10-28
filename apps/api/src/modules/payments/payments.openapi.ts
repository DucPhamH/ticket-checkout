import { z } from 'zod';
import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { ReturnParamsSchema } from './payments.schema';

const IpnResponseSchema = z
  .object({
    RspCode: z.enum(['00', '01', '02', '04', '97', '99']),
    Message: z.string().meta({ example: 'Confirm Success' }),
  })
  .meta({ id: 'VnpayIpnResponse' });

export const paymentsPaths: ZodOpenApiPathsObject = {
  '/payments/vnpay/ipn': {
    get: {
      tags: ['Payments'],
      summary: 'VNPay IPN (server-to-server)',
      description:
        'Called by VNPay with the same `vnp_*` parameters as the return URL. The source of truth for a payment: ' +
        'on success the order becomes `PAID` and the payment is posted to the ledger; on failure the order ' +
        'becomes `FAILED` and its tickets are released; a success after the tickets were released is recorded ' +
        'and owed back to the buyer. Always HTTP 200. `RspCode`: 00 done, 01 unknown reference, 02 already ' +
        'processed, 04 wrong amount, 97 bad signature, 99 missing input or unexpected error (VNPay retries ' +
        'anything but 00/02).',
      responses: {
        '200': { description: 'Answer for VNPay', content: { 'application/json': { schema: IpnResponseSchema } } },
      },
    },
  },
  '/payments/vnpay/return/{locale}': {
    get: {
      tags: ['Payments'],
      summary: 'VNPay return URL (browser redirect)',
      description:
        "VNPay sends the buyer's browser here after paying, with `vnp_*` query parameters and `vnp_SecureHash`. " +
        'The signature is verified and the message stored in `payment_notifications`, then the browser is ' +
        'redirected to the order page. **Does not change the order or payment status**: IPN does.',
      requestParams: {
        path: ReturnParamsSchema,
        query: z.object({
          vnp_TxnRef: z.string().optional().meta({ description: 'Our payment reference' }),
          vnp_ResponseCode: z.string().optional(),
          vnp_TransactionStatus: z.string().optional(),
          vnp_SecureHash: z.string().optional(),
        }),
      },
      responses: {
        '302': { description: 'Redirect to the order page (or the home page for an unknown reference)' },
      },
    },
  },
};
