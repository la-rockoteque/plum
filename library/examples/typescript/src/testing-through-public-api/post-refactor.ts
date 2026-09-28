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

// After a behaviour-preserving refactor: the fee helper is inlined and the rate field renamed.
// A caller of cancel() cannot tell this apart from PreRefactorService - same inputs, same outcome,
// same stored state, same notification. Only the private shape changed.
export class PostRefactorService {
  private readonly cancellationFeeRate = 0.1;
  private readonly formatter = new NotificationFormatter();

  constructor(
    public readonly orders: OrderRepository,
    public readonly notifier: Notifier,
  ) {}

  private transitionStatus(order: Order): void {
    order.status = OrderStatus.Cancelled;
  }

  cancel(orderId: number): CancellationOutcome {
    const order = this.orders.findById(orderId);
    // calculateFee() inlined here:
    const fee = Math.round(order.amountMinor * this.cancellationFeeRate);
    this.transitionStatus(order);
    const refundAmountMinor = order.amountMinor - fee;
    this.notifier.send(this.formatter.format(orderId, refundAmountMinor));
    this.orders.save(order);
    return { orderId, refundAmountMinor, status: order.status };
  }
}
