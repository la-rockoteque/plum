import { OrderNotFound } from "../application/cancel-order.js";

export interface OrderSummary {
  readonly id: number;
  readonly status: string;
  readonly canCancel: boolean;
}

export interface OrderSummaryReader {
  getSummary(orderId: number): OrderSummary | undefined;
}

export class GetOrderSummary {
  constructor(private readonly reader: OrderSummaryReader) {}

  execute(orderId: number): OrderSummary {
    const summary = this.reader.getSummary(orderId);
    if (!summary) throw new OrderNotFound(`Order ${orderId} not found`);
    return summary;
  }
}
