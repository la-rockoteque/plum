export class Order {
  status: string;

  constructor(
    public readonly id: string,
    public readonly customerEmail: string,
    public readonly cancellationFee: number,
    status = "placed",
  ) {
    this.status = status;
  }
}

export interface OrderRepository {
  findById(orderId: string): Order;
  save(order: Order): void;
}

export interface PaymentGateway {
  charge(orderId: string, amount: number): void;
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
    // never called here: a dummy satisfies this parameter in tests
    private readonly auditLogger: AuditLogger,
  ) {}

  execute(orderId: string): void {
    const order = this.orders.findById(orderId);
    this.gateway.charge(order.id, order.cancellationFee);
    order.status = "cancelled";
    this.mailer.send(order.customerEmail, `Your order ${order.id} was cancelled`);
    this.orders.save(order);
  }
}
