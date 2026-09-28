// One policy per order type: each owns both its fee and its refund
// description, so the two concerns can never fall out of sync again.
import { CUSTOM_MADE, EXPRESS, Order, STANDARD, SUBSCRIPTION } from "./order.js";

export const EXPRESS_FLAT_FEE = 15.0;
export const CUSTOM_MADE_FEE_RATE = 0.5;

export interface FeePolicy {
  fee(order: Order): number;
  describeRefund(order: Order): string;
}

export class StandardFeePolicy implements FeePolicy {
  fee(order: Order): number {
    return order.pending ? 0.0 : order.amount;
  }
  describeRefund(order: Order): string {
    return order.pending ? "Full refund, order not yet processed" : "No refund, order already shipped";
  }
}

export class ExpressFeePolicy implements FeePolicy {
  fee(_order: Order): number {
    return EXPRESS_FLAT_FEE;
  }
  describeRefund(_order: Order): string {
    return "Refund minus a flat express handling fee";
  }
}

export class CustomMadeFeePolicy implements FeePolicy {
  fee(order: Order): number {
    return order.amount * CUSTOM_MADE_FEE_RATE;
  }
  describeRefund(_order: Order): string {
    return "50% refund, materials already committed";
  }
}

export class SubscriptionFeePolicy implements FeePolicy {
  fee(order: Order): number {
    return (order.amount * order.monthsElapsed) / order.totalMonths;
  }
  describeRefund(_order: Order): string {
    return "Prorated refund for unused months";
  }
}

export const DEFAULT_POLICIES: Record<string, FeePolicy> = {
  [STANDARD]: new StandardFeePolicy(),
  [EXPRESS]: new ExpressFeePolicy(),
  [CUSTOM_MADE]: new CustomMadeFeePolicy(),
  [SUBSCRIPTION]: new SubscriptionFeePolicy(),
};
