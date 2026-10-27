import { BPS_DENOMINATOR, BUYER_FEE_BPS, SELLER_FEE_BPS } from './constants/fees';

export type OrderAmounts = {
  subtotal: number; // unitPrice × quantity
  buyerFee: number; // added on top for the buyer
  total: number; // what the buyer pays
  sellerFee: number; // deducted from the seller
  sellerPayout: number; // what the seller receives
  platformRevenue: number; // what we keep = total − sellerPayout
};

// Rounds half up; inputs are non-negative integers (VND has no minor unit).
function applyBps(amount: number, bps: number): number {
  return Math.floor((amount * bps + BPS_DENOMINATOR / 2) / BPS_DENOMINATOR);
}

export function calculateOrderAmounts(unitPrice: number, quantity: number): OrderAmounts {
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error('unitPrice must be a non-negative integer');
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('quantity must be a positive integer');

  const subtotal = unitPrice * quantity;
  const buyerFee = applyBps(subtotal, BUYER_FEE_BPS);
  const sellerFee = applyBps(subtotal, SELLER_FEE_BPS);
  const total = subtotal + buyerFee;
  const sellerPayout = subtotal - sellerFee;

  // Derived as the remainder so total === sellerPayout + platformRevenue always holds.
  const platformRevenue = total - sellerPayout;

  return { subtotal, buyerFee, total, sellerFee, sellerPayout, platformRevenue };
}
