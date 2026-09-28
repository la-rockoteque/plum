// before: a pluggable CancellationPolicy registry, hooks and a config flag — for one policy that exists.
export const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_POLICY_NAME = "standard";

export enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Cancelled = "cancelled",
}

export class Order {
  constructor(
    readonly id: number,
    readonly status: OrderStatus,
    readonly placedAtMs: number,
  ) {}
}

export interface Clock {
  nowMs(): number;
}

export interface CancellationPolicy {
  canCancel(order: Order, clock: Clock): boolean;
}

// The only policy that has ever existed.
export class StandardCancellationPolicy implements CancellationPolicy {
  canCancel(order: Order, clock: Clock): boolean {
    if (order.status !== OrderStatus.Pending) return false;
    return clock.nowMs() - order.placedAtMs <= CANCELLATION_WINDOW_MS;
  }
}

// Extension points nobody has ever wired up.
export class CancellationHooks {
  onBeforeCancel: Array<(order: Order) => void> = [];
  onAfterCancel: Array<(order: Order) => void> = [];
}

// A pluggable seam for a second policy that has never shown up.
export class CancellationPolicyRegistry {
  private readonly policies = new Map<string, CancellationPolicy>([
    [DEFAULT_POLICY_NAME, new StandardCancellationPolicy()],
  ]);

  register(name: string, policy: CancellationPolicy): void {
    this.policies.set(name, policy);
  }

  resolve(name: string): CancellationPolicy {
    // A typo in `name` is silently swallowed: it just falls back to the default.
    return this.policies.get(name) ?? this.policies.get(DEFAULT_POLICY_NAME)!;
  }
}

export class OrderCancellationService {
  readonly hooks: CancellationHooks;
  readonly strictMode: boolean; // dead: nothing reads this flag
  private readonly policy: CancellationPolicy;

  constructor(
    policyName: string = DEFAULT_POLICY_NAME,
    hooks: CancellationHooks = new CancellationHooks(),
    strictMode = false,
    registry: CancellationPolicyRegistry = new CancellationPolicyRegistry(),
  ) {
    this.hooks = hooks;
    this.strictMode = strictMode;
    this.policy = registry.resolve(policyName);
  }

  canCancel(order: Order, clock: Clock): boolean {
    for (const hook of this.hooks.onBeforeCancel) hook(order);
    const result = this.policy.canCancel(order, clock);
    for (const hook of this.hooks.onAfterCancel) hook(order);
    return result;
  }
}
