// One switch on order.type decides the fee — and it isn't the only one
// (see refund-description.ts).
import { CUSTOM_MADE, CUSTOM_MADE_FEE_RATE, EXPRESS, EXPRESS_FLAT_FEE, Order, STANDARD, SUBSCRIPTION } from "./order.js";

export class CancellationFeeCalculator {
  calculateFee(order: Order): number {
    switch (order.type) {
      case STANDARD:
        return order.pending ? 0.0 : order.amount;
      case EXPRESS:
        return EXPRESS_FLAT_FEE;
      case CUSTOM_MADE:
        return order.amount * CUSTOM_MADE_FEE_RATE;
      case SUBSCRIPTION:
        return (order.amount * order.monthsElapsed) / order.totalMonths;
      default:
        throw new Error(`unhandled order type: ${order.type}`);
    }
  }
}
