export interface Order {
  orderId: number;
  amountMinor: number;
  purchasedAtMs: number;
  status: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FULL_REFUND_WINDOW_DAYS = 14;
const LATE_REFUND_PERCENT = 90;
const STALE_ORDER_THRESHOLD_DAYS = 30;
const STALE_REFUND_ROUNDING_UNIT_MINOR = 100;

function ageInDays(order: Order, todayMs: number): number {
  return Math.floor((todayMs - order.purchasedAtMs) / MS_PER_DAY);
}

function baseRefundMinor(order: Order, ageDays: number): number {
  if (ageDays <= FULL_REFUND_WINDOW_DAYS) return order.amountMinor;
  return Math.floor((order.amountMinor * LATE_REFUND_PERCENT) / 100);
}

function roundDownIfStale(refundMinor: number, ageDays: number): number {
  if (ageDays > STALE_ORDER_THRESHOLD_DAYS) {
    return Math.floor(refundMinor / STALE_REFUND_ROUNDING_UNIT_MINOR) * STALE_REFUND_ROUNDING_UNIT_MINOR;
  }
  return refundMinor;
}

// Same behaviour as legacy computeRefund, including its odd cases - named and pinned by the
// characterization tests below rather than "fixed" in passing.
export function computeRefund(order: Order, todayMs: number): number {
  if (order.status === "hold") return 0;
  const ageDays = ageInDays(order, todayMs);
  const refund = baseRefundMinor(order, ageDays);
  return roundDownIfStale(refund, ageDays);
}
