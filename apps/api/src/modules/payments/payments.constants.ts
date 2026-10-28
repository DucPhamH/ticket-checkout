// What we concluded from a message from the gateway, stored in payment_notifications.result.
export const RETURN_RESULT = {
  // Signature valid; the gateway reported this outcome to the browser. Not acted on: IPN is the
  // source of truth for the payment status.
  reportedSuccess: 'REPORTED_SUCCESS',
  reportedFailure: 'REPORTED_FAILURE',
  invalidSignature: 'INVALID_SIGNATURE',
  unknownPayment: 'UNKNOWN_PAYMENT',
} as const;
