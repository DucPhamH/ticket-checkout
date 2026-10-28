// Listing rules, shared so the "Sell tickets" form and the api validation agree.

// Prices in VND, in steps of 1,000. The cap keeps the largest possible order
// (10 × 100,000,000 + 10% fee = 1.1 billion) within VNPay's 12-digit vnp_Amount (VND × 100).
export const LISTING_PRICE_MIN = 10_000;
export const LISTING_PRICE_MAX = 100_000_000;
export const LISTING_PRICE_STEP = 1_000;

export const MAX_TICKETS_PER_LISTING = 50;
