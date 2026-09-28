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

// The only persistence contract available. CancelOrder depends on all seven methods
// below even though it only ever calls two of them.
export interface OrderStoreV1 {
  get(orderId: number): Order;
  save(order: Order): void;
  delete(orderId: number): void;
  listByCustomer(customerEmail: string): Order[];
  exportCsv(): string;
  auditTrail(orderId: number): string[];
  purgeOlderThan(days: number): number;
}

// The fat interface grows an eighth method. Every implementer -- including a fake
// written for a use case that never touches archiving -- must grow with it.
export interface OrderStoreV2 extends OrderStoreV1 {
  archive(orderId: number): void;
}

// Depends on the whole fat interface, though it only ever calls get and save.
export class CancelOrder {
  constructor(private readonly store: OrderStoreV1) {}

  execute(orderId: number): void {
    const order = this.store.get(orderId);
    order.status = "cancelled";
    this.store.save(order);
  }
}
