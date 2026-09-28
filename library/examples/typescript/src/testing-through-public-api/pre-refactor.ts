export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export class Order {
  status: OrderStatus;

  constructor(
    public readonly id: number,
    public readonly amountMinor: number,
    status = OrderStatus.Pending,
  ) {
    this.status = status;
  }
}

export interface OrderRepository {
  findById(orderId: number): Order;
  save(order: Order): void;
}

export interface Notifier {
  send(message: string): void;
}

export interface CancellationOutcome {
  orderId: number;
  refundAmountMinor: number;
  status: OrderStatus;
}

// The unit's own internal collaborator: constructed by the service, never injected.
export class NotificationFormatter {
  format(orderId: number, refundAmountMinor: number): string {
    return `Order ${orderId} cancelled; refund ${refundAmountMinor}`;
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
    return Math.round(order.amountMinor * this.feeRate);
  }

  private transitionStatus(order: Order): void {
    order.status = OrderStatus.Cancelled;
  }

  cancel(orderId: number): CancellationOutcome {
    const order = this.orders.findById(orderId);
    const fee = this.calculateFee(order);
    this.transitionStatus(order);
    const refundAmountMinor = order.amountMinor - fee;
    this.notifier.send(this.formatter.format(orderId, refundAmountMinor));
    this.orders.save(order);
    return { orderId, refundAmountMinor, status: order.status };
  }
}
