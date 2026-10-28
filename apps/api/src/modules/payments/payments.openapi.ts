import { z } from 'zod';
import type { ZodOpenApiPathsObject } from 'zod-openapi';
import { ReturnParamsSchema } from './payments.schema';

export const paymentsPaths: ZodOpenApiPathsObject = {
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
