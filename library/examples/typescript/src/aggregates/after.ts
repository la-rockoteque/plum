const MAX_LINES = 10;

export type OrderStatus = "pending" | "shipped" | "cancelled";

export class OrderCancelledError extends Error {}
export class InvalidQuantityError extends Error {}
export class TooManyLinesError extends Error {}
export class LineNotFoundError extends Error {}
export class CurrencyMismatchError extends Error {}

// Held only inside the aggregate; callers only ever see copies of it.
export class OrderLine {
  constructor(
    public id: number,
    public sku: string,
    public quantity: number,
    public unitPriceMinor: number,
  ) {}

  copy(): OrderLine {
    return new OrderLine(this.id, this.sku, this.quantity, this.unitPriceMinor);
  }
}

// The aggregate root: the only entry point for reading or changing its lines.
export class Order {
  private lines_: OrderLine[] = [];
  private nextLineId = 1;

  constructor(
    public readonly id: number,
    private readonly currency: string = "USD",
    private _status: OrderStatus = "pending",
  ) {}

  get status(): OrderStatus {
    return this._status;
  }

  // Returns copies: mutating the result can never change the aggregate's state.
  get lines(): OrderLine[] {
    return this.lines_.map((line) => line.copy());
  }

  // Always derived from the current lines — never a cache that can go stale.
  get totalMinor(): number {
    return this.lines_.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0);
  }

  addLine(sku: string, quantity: number, unitPriceMinor: number, currency: string): number {
    this.guard(quantity);
    if (currency !== this.currency) throw new CurrencyMismatchError(`line currency ${currency} does not match order currency ${this.currency}`);
    if (this.lines_.length >= MAX_LINES) throw new TooManyLinesError(`an order can have at most ${MAX_LINES} lines`);
    const line = new OrderLine(this.nextLineId, sku, quantity, unitPriceMinor);
    this.nextLineId += 1;
    this.lines_.push(line);
    return line.id;
  }

  changeQuantity(lineId: number, quantity: number): void {
    this.guard(quantity);
    const line = this.lines_.find((l) => l.id === lineId);
    if (!line) throw new LineNotFoundError(`no such line: ${lineId}`);
    line.quantity = quantity;
  }

  // Enforces the aggregate's own invariant: a shipped or already-cancelled order can't be cancelled.
  cancel(): void {
    if (this._status !== "pending") throw new OrderCancelledError("cannot cancel a shipped or already-cancelled order");
    this._status = "cancelled";
  }

  // Detached copy: used by the repository so a stored order is never a live reference.
  copy(): Order {
    const clone = new Order(this.id, this.currency, this._status);
    clone.lines_ = this.lines;
    clone.nextLineId = this.nextLineId;
    return clone;
  }

  private guard(quantity: number): void {
    if (this._status === "cancelled") throw new OrderCancelledError("cannot modify a cancelled order");
    if (quantity < 1) throw new InvalidQuantityError("quantity must be at least 1");
  }
}

// One repository per aggregate: it saves and loads the whole Order, not individual lines.
export class OrderRepository {
  private orders = new Map<number, Order>();

  save(order: Order): void {
    this.orders.set(order.id, order.copy());
  }

  get(orderId: number): Order | undefined {
    return this.orders.get(orderId)?.copy();
  }
}
