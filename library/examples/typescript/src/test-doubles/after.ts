export type ChargeResult = "approved" | "declined";

export class Order {
  status: string;

  constructor(
    public readonly id: number,
    public readonly customerEmail: string,
    public readonly amountMinor: number,
    status = "pending",
  ) {
    this.status = status;
  }
}

export interface OrderRepository {
  get(orderId: number): Order;
  save(order: Order): void;
}

export interface PaymentGateway {
  charge(orderId: number, amountMinor: number): ChargeResult;
}

export interface Mailer {
  send(to: string, message: string): void;
}

export interface AuditLogger {
  log(message: string): void;
}

// Every collaborator is a port; the composition root decides which double or adapter plugs in.
export class CancelOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly gateway: PaymentGateway,
    private readonly mailer: Mailer,
    private readonly auditLogger: AuditLogger,
  ) {}

  execute(orderId: number): void {
    const order = this.orders.get(orderId);
    const result = this.gateway.charge(order.id, order.amountMinor);
    if (result === "declined") {
      // A declined charge is a legitimate business outcome, not a crash: the audit
      // logger is a real collaborator on this path, even though the happy path never
      // touches it.
      this.auditLogger.log(`charge declined for order ${order.id}`);
      return;
    }
    order.status = "cancelled";
    this.mailer.send(order.customerEmail, `Your order ${order.id} was cancelled`);
    this.orders.save(order);
  }
}
