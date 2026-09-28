export class Order {
  status: string;

  constructor(
    public readonly id: string,
    public readonly total: number,
    status = "placed",
  ) {
    this.status = status;
  }
}

export interface OrderRepository {
  findById(orderId: string): Order;
  save(order: Order): void;
}

export interface Notifier {
  send(message: string): void;
}

export interface CancellationOutcome {
  orderId: string;
  refundAmount: number;
  status: string;
}

// The unit's own internal collaborator: constructed by the service, never injected.
export class NotificationFormatter {
  format(orderId: string, refundAmount: number): string {
    return `Order ${orderId} cancelled; refund ${refundAmount.toFixed(2)}`;
  }
}

// Before the refactor: a separate fee helper and a plainly-named rate field.
export class PreRefactorService {
  private readonly feeRate = 0.1;
  private readonly formatter = new NotificationFormatter();

  constructor(
    public readonly orders: OrderRepository,
    public readonly notifier: Notifier,
  ) {}

  private calculateFee(order: Order): number {
    return Math.round(order.total * this.feeRate * 100) / 100;
  }

  private transitionStatus(order: Order): void {
    order.status = "cancelled";
  }

  cancel(orderId: string): CancellationOutcome {
    const order = this.orders.findById(orderId);
    const fee = this.calculateFee(order);
    this.transitionStatus(order);
    const refundAmount = Math.round((order.total - fee) * 100) / 100;
    this.notifier.send(this.formatter.format(orderId, refundAmount));
    this.orders.save(order);
    return { orderId, refundAmount, status: order.status };
  }
}
