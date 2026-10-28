// How long tickets stay reserved for an unpaid order. Also sent to VNPay as the payment deadline.
export const RESERVATION_MINUTES = 15;

// How often the background job looks for unpaid orders past their reservation.
export const ORDER_EXPIRY_SWEEP_SECONDS = 60;

// Max orders expired per transaction, so a big backlog never holds locks for long.
export const ORDER_EXPIRY_BATCH_SIZE = 1000;
