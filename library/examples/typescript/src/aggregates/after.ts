const MAX_LINES = 10;

export class OrderCancelledError extends Error {}
export class InvalidQuantityError extends Error {}
export class TooManyLinesError extends Error {}
export class LineNotFoundError extends Error {}

// Held only inside the aggregate; callers only ever see copies of it.
export class OrderLine {
  constructor(
    public id: number,
    public sku: string,
    public quantity: number,
    public unitPriceMinor: number,
    public currency: string,
  ) {}

  copy(): OrderLine {
    return new OrderLine(this.id, this.sku, this.quantity, this.unitPriceMinor, this.currency);
  }
}

// The aggregate root: the only entry point for reading or changing its lines.
export class Order {
  private _status = "pending";
  private lines_: OrderLine[] = [];
  private nextLineId = 1;

  constructor(
    public readonly id: number,
    private readonly currency: string = "USD",
  ) {}

  get status(): string {
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

  addLine(sku: string, quantity: number, unitPriceMinor: number): number {
    this.guardNotCancelled();
    this.guardQuantity(quantity);
    if (this.lines_.length >= MAX_LINES) {
      throw new TooManyLinesError(`an order can have at most ${MAX_LINES} lines`);
    }
    const line = new OrderLine(this.nextLineId, sku, quantity, unitPriceMinor, this.currency);
    this.nextLineId += 1;
    this.lines_.push(line);
    return line.id;
  }

  changeQuantity(lineId: number, quantity: number): void {
    this.guardNotCancelled();
    this.guardQuantity(quantity);
    this.find(lineId).quantity = quantity;
  }

  removeLine(lineId: number): void {
    this.guardNotCancelled();
    const index = this.indexOf(lineId);
    this.lines_.splice(index, 1);
  }

  cancel(): void {
    this._status = "cancelled";
  }

  private find(lineId: number): OrderLine {
    const line = this.lines_.find((l) => l.id === lineId);
    if (!line) throw new LineNotFoundError(`no such line: ${lineId}`);
    return line;
  }

  private indexOf(lineId: number): number {
    const index = this.lines_.findIndex((l) => l.id === lineId);
    if (index === -1) throw new LineNotFoundError(`no such line: ${lineId}`);
    return index;
  }

  private guardNotCancelled(): void {
    if (this._status === "cancelled") {
      throw new OrderCancelledError("cannot modify a cancelled order");
    }
  }

  private guardQuantity(quantity: number): void {
    if (quantity < 1) {
      throw new InvalidQuantityError("quantity must be at least 1");
    }
  }
}

// One repository per aggregate: it saves and loads the whole Order, not individual lines.
export class OrderRepository {
  private orders = new Map<number, Order>();

  save(order: Order): void {
    this.orders.set(order.id, order);
  }

  get(orderId: number): Order | undefined {
    return this.orders.get(orderId);
  }
}
