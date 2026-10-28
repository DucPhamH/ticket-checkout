// What we concluded from a message from the gateway, stored in payment_notifications.result.
export const RETURN_RESULT = {
  // Signature valid; the gateway reported this outcome to the browser. Not acted on: IPN is the
  // source of truth for the payment status.
  reportedSuccess: 'REPORTED_SUCCESS',
  reportedFailure: 'REPORTED_FAILURE',
  invalidSignature: 'INVALID_SIGNATURE',
  unknownPayment: 'UNKNOWN_PAYMENT',
} as const;

// IPN answers, as VNPay expects them. VNPay stops retrying after 00 or 02; any other code (or no
// answer) makes it retry, up to 10 times, 5 minutes apart.
export const IPN_RESPONSE = {
  success: { RspCode: '00', Message: 'Confirm Success' },
  orderNotFound: { RspCode: '01', Message: 'Order not found' },
  alreadyConfirmed: { RspCode: '02', Message: 'Order already confirmed' },
  invalidAmount: { RspCode: '04', Message: 'invalid amount' },
  invalidSignature: { RspCode: '97', Message: 'Invalid signature' },
  inputRequired: { RspCode: '99', Message: 'Input data required' },
  unknownError: { RspCode: '99', Message: 'Unknown error' },
} as const;

export type IpnResponse = (typeof IPN_RESPONSE)[keyof typeof IPN_RESPONSE];

// Why a refund was created (refunds.reason).
export const LATE_PAYMENT_REFUND_REASON = 'LATE_PAYMENT'; // paid after the tickets were sold to someone else
export const EVENT_ENDED_REFUND_REASON = 'EVENT_ENDED'; // paid after the event was completed or cancelled
export const EVENT_CANCELLED_REFUND_REASON = 'EVENT_CANCELLED'; // paid, then the event was cancelled
