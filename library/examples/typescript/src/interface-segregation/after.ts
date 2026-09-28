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

// A role interface owned by CancelOrder: only what it needs, declared next to it.
export interface CancelOrderStore {
  get(orderId: number): Order;
  save(order: Order): void;
}

// A separate role interface for a different client. CancelOrder never sees it.
export interface OrderArchiver {
  archive(orderId: number): void;
}

export class CancelOrder {
  constructor(private readonly store: CancelOrderStore) {}

  execute(orderId: number): void {
    const order = this.store.get(orderId);
    order.status = "cancelled";
    this.store.save(order);
  }
}

// The concrete adapter implements several role interfaces at once; CancelOrder only
// ever depends on the narrow one (CancelOrderStore).
export class OrderStoreAdapter implements CancelOrderStore, OrderArchiver {
  private readonly orders = new Map<number, Order>();

  get(orderId: number): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`unknown order ${orderId}`);
    return order;
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
  }

  archive(orderId: number): void {
    this.get(orderId).status = "archived";
  }
}
