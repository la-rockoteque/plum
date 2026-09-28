// A line entity with its own identity — nothing stops a caller reaching it directly.
export class OrderLine {
  constructor(
    public id: number,
    public orderId: number,
    public sku: string,
    public quantity: number,
    public unitPriceMinor: number,
    public currency: string,
  ) {}
}

// Lines get their own repository/collection, so callers can bypass the order entirely.
export class OrderLineRepository {
  private lines = new Map<number, OrderLine>();

  add(line: OrderLine): void {
    this.lines.set(line.id, line);
  }

  updateQuantity(lineId: number, quantity: number): void {
    const line = this.lines.get(lineId);
    if (!line) throw new Error(`no such line: ${lineId}`);
    line.quantity = quantity;
  }

  remove(lineId: number): void {
    this.lines.delete(lineId);
  }

  forOrder(orderId: number): OrderLine[] {
    return [...this.lines.values()].filter((line) => line.orderId === orderId);
  }
}

// totalMinor is a cache: correct only if every caller remembers to refresh it.
export class Order {
  constructor(
    public id: number,
    public status: string = "pending",
    public totalMinor: number = 0,
    public currency: string = "USD",
  ) {}
}

// Refreshes the cached total from the current lines — easy to forget to call.
export function recomputeTotal(order: Order, lines: OrderLine[]): void {
  order.totalMinor = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0);
}
