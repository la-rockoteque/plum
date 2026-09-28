// The same switch, copy-pasted here for the customer-facing message — kept in
// sync for express and subscription, never updated when custom-made orders
// were added.
import { EXPRESS, Order, STANDARD, SUBSCRIPTION } from "./order.js";

export class RefundDescription {
  describe(order: Order): string {
    switch (order.type) {
      case STANDARD:
        return order.pending ? "Full refund, order not yet processed" : "No refund, order already shipped";
      case EXPRESS:
        return "Refund minus a flat express handling fee";
      case SUBSCRIPTION:
        return "Prorated refund for unused months";
      default:
        return "Refund processed";
    }
  }
}
