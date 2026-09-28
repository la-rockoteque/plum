// after: cancel() only changes state and records an event; handlers react later.
export class OrderAlreadyCancelledError extends Error {}

export interface Clock {
  nowMs(): number;
}

export interface InventoryService {
  release(orderId: number): void;
}

export interface Mailer {
  sendCancellationEmail(orderId: number): void;
}

export interface LoyaltyLedger {
  recordCancellation(orderId: number): void;
}

// An immutable fact: this happened. Not a request for anything to happen.
export class OrderCancelled {
  constructor(
    public readonly orderId: number,
    public readonly reason: string,
    public readonly occurredAtMs: number,
  ) {}
}

// The aggregate root: cancel() changes state and records what happened, nothing else.
export class Order {
  private _status = "pending";
  private events: OrderCancelled[] = [];

  constructor(public readonly id: number) {}

  get status(): string {
    return this._status;
  }

  cancel(reason: string, clock: Clock): void {
    if (this._status === "cancelled") {
      throw new OrderAlreadyCancelledError("order is already cancelled");
    }
    this._status = "cancelled";
    this.events.push(new OrderCancelled(this.id, reason, clock.nowMs()));
  }

  // Returns the recorded events and clears them, so a dispatch is never repeated.
  pullEvents(): OrderCancelled[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export interface OrderRepository {
  get(orderId: number): Order | undefined;
  save(order: Order): void;
}

export class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<number, Order>();

  get(orderId: number): Order | undefined {
    return this.orders.get(orderId);
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
  }
}

export interface EventHandler {
  handle(event: OrderCancelled): void;
}

// A plain list of handlers per event type. No framework, no ordering guarantees beyond registration order.
export class EventDispatcher {
  private handlers = new Map<Function, EventHandler[]>();

  register(eventType: Function, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  dispatch(events: OrderCancelled[]): void {
    for (const event of events) {
      const list = this.handlers.get(event.constructor) ?? [];
      for (const handler of list) handler.handle(event);
    }
  }
}

export class ReleaseInventoryHandler implements EventHandler {
  constructor(private readonly inventory: InventoryService) {}
  handle(event: OrderCancelled): void {
    this.inventory.release(event.orderId);
  }
}

export class SendCancellationEmailHandler implements EventHandler {
  constructor(private readonly mailer: Mailer) {}
  handle(event: OrderCancelled): void {
    this.mailer.sendCancellationEmail(event.orderId);
  }
}

export class RecordLoyaltyCancellationHandler implements EventHandler {
  constructor(private readonly loyalty: LoyaltyLedger) {}
  handle(event: OrderCancelled): void {
    this.loyalty.recordCancellation(event.orderId);
  }
}

// The application service: save the aggregate, then dispatch what it recorded.
export class CancelOrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly dispatcher: EventDispatcher,
    private readonly clock: Clock,
  ) {}

  cancel(orderId: number, reason: string): void {
    const order = this.repo.get(orderId);
    if (!order) throw new Error(`no such order: ${orderId}`);
    order.cancel(reason, this.clock);
    this.repo.save(order);
    this.dispatcher.dispatch(order.pullEvents());
  }
}
