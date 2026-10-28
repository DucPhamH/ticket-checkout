import { describe, expect, it } from 'vitest';
import { getVnpayConfig } from '../../../src/modules/payments/vnpay/vnpay.config';
import { formatVnpayDate } from '../../../src/modules/payments/vnpay/vnpay.date';
import { toVnpayOrderInfo } from '../../../src/modules/payments/vnpay/vnpay.order-info';
import { buildVnpayPaymentUrl } from '../../../src/modules/payments/vnpay/vnpay.payment-url';
import {
  buildSignData,
  encodeVnpayValue,
  signVnpayParams,
  verifyVnpaySignature,
} from '../../../src/modules/payments/vnpay/vnpay.signature';

const SECRET = 'TEST_SECRET_FOR_UNIT_TESTS_ONLY';
const config = {
  tmnCode: 'TESTCODE',
  hashSecret: SECRET,
  payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  apiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
};

// Decodes a URL query the way Express does (so "+" becomes a space).
const queryOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('encodeVnpayValue', () => {
  it('percent-encodes and writes spaces as "+"', () => {
    expect(encodeVnpayValue('Thanh toan don hang 72')).toBe('Thanh+toan+don+hang+72');
    expect(encodeVnpayValue('http://localhost:4000/payments/vnpay/return/vi')).toBe(
      'http%3A%2F%2Flocalhost%3A4000%2Fpayments%2Fvnpay%2Freturn%2Fvi',
    );
  });
});

describe('signing', () => {
  const params = {
    vnp_Version: '2.1.0',
    vnp_TmnCode: 'TESTCODE',
    vnp_ReturnUrl: 'http://localhost:4000/payments/vnpay/return/vi',
    vnp_Command: 'pay',
    vnp_OrderInfo: 'Thanh toan don hang 72',
    vnp_Amount: '99000000',
  };

  it('signs the parameters sorted by name, encoded, joined with &', () => {
    expect(buildSignData(params)).toBe(
      'vnp_Amount=99000000&vnp_Command=pay&vnp_OrderInfo=Thanh+toan+don+hang+72' +
        '&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A4000%2Fpayments%2Fvnpay%2Freturn%2Fvi' +
        '&vnp_TmnCode=TESTCODE&vnp_Version=2.1.0',
    );
  });

  it('matches an HMAC-SHA512 computed independently with openssl', () => {
    // printf '%s' "<sign data above>" | openssl dgst -sha512 -hmac 'TEST_SECRET_FOR_UNIT_TESTS_ONLY'
    expect(signVnpayParams(params, SECRET)).toBe(
      '3b7a4d526f760700f22e7b93a3a90c0be2e07fc1fbca824e8d751c69b3ea591864aca272ef5699d6d0bf2c3ff96355a9625ae01527aba4154c60316ed311d08f',
    );
  });

  it('leaves the signature fields out of the signed data', () => {
    const withHash = { ...params, vnp_SecureHash: 'abc', vnp_SecureHashType: 'HmacSHA512' };
    expect(buildSignData(withHash)).toBe(buildSignData(params));
  });
});

describe('verifyVnpaySignature', () => {
  const signedQuery = () => {
    const params: Record<string, string> = { vnp_Amount: '99000000', vnp_TxnRef: '72T1', vnp_ResponseCode: '00' };
    return { ...params, vnp_SecureHash: signVnpayParams(params, SECRET) };
  };

  it('accepts what we signed, in either letter case', () => {
    const query = signedQuery();
    expect(verifyVnpaySignature(query, SECRET)).toBe(true);
    expect(verifyVnpaySignature({ ...query, vnp_SecureHash: query.vnp_SecureHash.toUpperCase() }, SECRET)).toBe(true);
  });

  it('rejects a tampered amount', () => {
    expect(verifyVnpaySignature({ ...signedQuery(), vnp_Amount: '100' }, SECRET)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    expect(verifyVnpaySignature(signedQuery(), 'another-secret')).toBe(false);
  });

  it('rejects a missing or malformed signature', () => {
    const { vnp_SecureHash: _drop, ...unsigned } = signedQuery();
    expect(verifyVnpaySignature(unsigned, SECRET)).toBe(false);
    expect(verifyVnpaySignature({ ...unsigned, vnp_SecureHash: 'not-hex' }, SECRET)).toBe(false);
  });

  it('ignores vnp_SecureHashType when verifying', () => {
    expect(verifyVnpaySignature({ ...signedQuery(), vnp_SecureHashType: 'HmacSHA512' }, SECRET)).toBe(true);
  });
});

describe('formatVnpayDate', () => {
  it('formats the instant in GMT+7 as yyyyMMddHHmmss', () => {
    expect(formatVnpayDate(new Date('2026-10-28T03:04:05Z'))).toBe('20261028100405');
  });

  it('rolls over to the next day after 17:00 UTC', () => {
    expect(formatVnpayDate(new Date('2026-12-31T20:00:00Z'))).toBe('20270101030000');
  });
});

describe('toVnpayOrderInfo', () => {
  it('removes Vietnamese diacritics and special characters', () => {
    expect(toVnpayOrderInfo('Đơn #72 – Hà Nội Indie Night!')).toBe('Don 72 Ha Noi Indie Night');
  });

  it('caps the length at 255', () => {
    expect(toVnpayOrderInfo('a'.repeat(300))).toHaveLength(255);
  });
});

describe('buildVnpayPaymentUrl', () => {
  const input = {
    txnRef: '72T1lq8x3k',
    amountVnd: 990_000,
    orderInfo: 'Thanh toán đơn hàng #72',
    ipAddr: '127.0.0.1',
    locale: 'vn' as const,
    returnUrl: 'http://localhost:4000/payments/vnpay/return/vi',
    createdAt: new Date('2026-10-28T03:00:00Z'),
    expiresAt: new Date('2026-10-28T03:15:00Z'),
  };

  it('contains every required 2.1.0 parameter, with the amount ×100 and GMT+7 dates', () => {
    const query = queryOf(buildVnpayPaymentUrl(input, config));
    expect(query).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '99000000',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: '72T1lq8x3k',
      vnp_OrderInfo: 'Thanh toan don hang 72',
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: '20261028100000',
      vnp_ExpireDate: '20261028101500',
    });
    expect(query).not.toHaveProperty('vnp_SecureHashType');
  });

  it('produces a URL whose signature verifies after the browser decodes it', () => {
    expect(verifyVnpaySignature(queryOf(buildVnpayPaymentUrl(input, config)), SECRET)).toBe(true);
  });
});

describe('getVnpayConfig', () => {
  const valid = {
    VNP_TMN_CODE: 'ABCD1234',
    VNP_HASH_SECRET: 'secret',
    VNP_PAY_URL: 'https://sandbox.vnpayment.vn/x',
    VNP_API_URL: 'https://sandbox.vnpayment.vn/api',
  };

  it('returns the credentials when they are valid', () => {
    expect(getVnpayConfig(valid)).toEqual({
      tmnCode: 'ABCD1234',
      hashSecret: 'secret',
      payUrl: valid.VNP_PAY_URL,
      apiUrl: valid.VNP_API_URL,
    });
  });

  it('lists every problem when credentials are missing', () => {
    expect(() => getVnpayConfig({ VNP_PAY_URL: valid.VNP_PAY_URL })).toThrow(
      /VNP_TMN_CODE is missing[\s\S]*VNP_HASH_SECRET is missing/,
    );
  });

  it('rejects a terminal code that is not 8 characters', () => {
    expect(() => getVnpayConfig({ ...valid, VNP_TMN_CODE: 'ABC' })).toThrow(/8-character terminal code/);
  });
});
