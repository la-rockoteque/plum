// Chooses the policy once, by order type; a new type means adding to the map
// passed in here, never a new branch in this class.
import { DEFAULT_POLICIES, FeePolicy } from "./fee-policy.js";
import { Order } from "./order.js";

export class CancellationFeeCalculator {
  constructor(private readonly policies: Record<string, FeePolicy> = DEFAULT_POLICIES) {}

  calculateFee(order: Order): number {
    return this.policies[order.type].fee(order);
  }

  describeRefund(order: Order): string {
    return this.policies[order.type].describeRefund(order);
  }
}
