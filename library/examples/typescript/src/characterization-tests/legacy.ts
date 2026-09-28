export interface Order {
  orderId: number;
  amountMinor: number;
  purchasedAtMs: number;
  status: string;
}

// Nobody who still works here wrote this. It has never had a test.
export function computeRefund(order: Order, todayMs: number): number {
  if (order.status === "hold") {
    return 0;
  } else {
    const ageDays = Math.floor((todayMs - order.purchasedAtMs) / 86400000);
    let refund: number;
    if (ageDays <= 14) {
      refund = order.amountMinor;
    } else {
      refund = Math.floor((order.amountMinor * 90) / 100);
    }
    if (ageDays > 30) {
      return Math.floor(refund / 100) * 100;
    } else {
      return refund;
    }
  }
}
