export class InvalidStatusTransition extends Error {}

export class UnknownStatus extends Error {}

// A value object: only these states exist, and only some moves between them are legal.
export class OrderStatus {
  private static readonly PENDING_VALUE = "pending";
  private static readonly SHIPPED_VALUE = "shipped";
  private static readonly CANCELLED_VALUE = "cancelled";

  static readonly Pending = new OrderStatus(OrderStatus.PENDING_VALUE);
  static readonly Shipped = new OrderStatus(OrderStatus.SHIPPED_VALUE);
  static readonly Cancelled = new OrderStatus(OrderStatus.CANCELLED_VALUE);

  private constructor(readonly value: string) {}

  static parse(value: string): OrderStatus {
    if (value === OrderStatus.PENDING_VALUE) return OrderStatus.Pending;
    if (value === OrderStatus.SHIPPED_VALUE) return OrderStatus.Shipped;
    if (value === OrderStatus.CANCELLED_VALUE) return OrderStatus.Cancelled;
    throw new UnknownStatus(`Unknown order status: ${value}`);
  }

  transitionTo(target: OrderStatus): OrderStatus {
    const legal =
      this.value === OrderStatus.PENDING_VALUE &&
      (target.value === OrderStatus.SHIPPED_VALUE || target.value === OrderStatus.CANCELLED_VALUE);
    if (legal) return target;
    throw new InvalidStatusTransition(`Cannot move from ${this.value} to ${target.value}`);
  }

  equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }
}

export class CurrencyMismatch extends Error {}

// A value object: immutable, compared by value, and blind to arithmetic across currencies.
export class Money {
  constructor(
    readonly amountMinor: number,
    readonly currency: string,
  ) {}

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new CurrencyMismatch(`Cannot add ${other.currency} to ${this.currency}`);
    }
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }
}

// An entity: two Orders are the same order iff they share an id, whatever their attributes.
export class Order {
  private _status: OrderStatus;

  constructor(
    readonly id: number,
    status: OrderStatus,
    public total: Money,
  ) {
    this._status = status;
  }

  // Read-only from outside: the only way to change status is ship()/cancel(), which enforce
  // legal transitions. There is no public setter, so a caller can't reach back in and reset it.
  get status(): OrderStatus {
    return this._status;
  }

  ship(): void {
    this._status = this._status.transitionTo(OrderStatus.Shipped);
  }

  cancel(): void {
    this._status = this._status.transitionTo(OrderStatus.Cancelled);
  }

  equals(other: Order): boolean {
    return this.id === other.id;
  }
}
