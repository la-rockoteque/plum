// An order built from bare primitives: status and money carry no rules of their own.
export class Order {
  constructor(
    public id: number,
    public status: string = "pending",
    public total: number = 0,
    public currency: string = "USD",
  ) {}
}

// Adds two orders' totals. Nothing here notices the currencies might differ.
export function addTotals(a: Order, b: Order): number {
  return a.total + b.total;
}
