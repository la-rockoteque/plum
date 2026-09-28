// Shared test fixture for the frontend track: an in-memory stand-in for the order service's HTTP API.
// Concepts import it instead of hitting a network. Latency and failures are controlled explicitly by tests.

export type OrderStatus = "pending" | "cancelled";

export interface OrderLine {
  readonly sku: string;
  readonly name: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
}

export interface OrderDto {
  readonly id: number;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLine[];
}

export class ApiError extends Error {}

export class InMemoryOrderApi {
  private orders = new Map<number, OrderDto>();
  private pending: Array<() => void> = [];

  // When true, requests wait until release() is called — lets tests observe loading and race states.
  holdResponses = false;
  failNext: string | null = null;

  constructor(seed: OrderDto[] = [sampleOrder()]) {
    for (const o of seed) this.orders.set(o.id, o);
  }

  getOrder(id: number): Promise<OrderDto> {
    return this.respond(() => {
      const order = this.orders.get(id);
      if (!order) throw new ApiError(`Order ${id} not found`);
      return order;
    });
  }

  updateLines(id: number, lines: readonly OrderLine[]): Promise<OrderDto> {
    return this.respond(() => this.replace(id, (o) => ({ ...o, lines })));
  }

  cancel(id: number): Promise<OrderDto> {
    return this.respond(() => this.replace(id, (o) => {
      if (o.status === "cancelled") throw new ApiError(`Order ${id} already cancelled`);
      return { ...o, status: "cancelled" };
    }));
  }

  // Resolve every held request, in the order they were made.
  release(): void {
    const queued = this.pending;
    this.pending = [];
    for (const resolve of queued) resolve();
  }

  private replace(id: number, change: (o: OrderDto) => OrderDto): OrderDto {
    const order = this.orders.get(id);
    if (!order) throw new ApiError(`Order ${id} not found`);
    const next = change(order);
    this.orders.set(id, next);
    return next;
  }

  private respond<T>(work: () => T): Promise<T> {
    const failure = this.failNext;
    this.failNext = null;
    const settle = () => {
      if (failure) throw new ApiError(failure);
      return work();
    };
    if (!this.holdResponses) return Promise.resolve().then(settle);
    return new Promise<void>((resolve) => this.pending.push(resolve)).then(settle);
  }
}

export function sampleOrder(): OrderDto {
  return {
    id: 1,
    status: "pending",
    lines: [
      { sku: "MUG-01", name: "Enamel mug", unitPriceCents: 1800, quantity: 2 },
      { sku: "TEA-12", name: "Loose-leaf tea, 100 g", unitPriceCents: 1250, quantity: 1 }
    ]
  };
}
