import { vi } from 'vitest';
import { signQueryDrResponse } from '../../src/modules/payments/vnpay/vnpay.querydr';

export const TEST_SECRET = 'TEST_SECRET_FOR_UNIT_TESTS_ONLY';

// Makes the next querydr call get this answer from "VNPay", signed with the test secret.
export function mockVnpayQuery(fields: Record<string, string>, secret = TEST_SECRET) {
  const body = {
    vnp_ResponseId: 'resp-1',
    vnp_Command: 'querydr',
    vnp_ResponseCode: '00',
    vnp_Message: 'QueryDR success',
    vnp_TmnCode: 'TESTCODE',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20261028110327',
    vnp_TransactionNo: '15717032',
    vnp_TransactionType: '01',
    vnp_OrderInfo: 'Thanh toan don hang',
    ...fields,
  };
  const signed = { ...body, vnp_SecureHash: signQueryDrResponse(body, secret) };
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(signed), { status: 200 }));
}
