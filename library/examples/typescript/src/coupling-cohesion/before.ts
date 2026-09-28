// Teaching artifact: the service reaches into the customer's fields to compute a discount.
// When Customer's tier becomes a value type instead of a raw string, OrderService can't reuse
// its existing logic on the new shape - it needs a whole new method just to read it.

export enum LoyaltyTier {
  Gold = "gold",
  Silver = "silver",
  Bronze = "bronze",
}

export interface Customer {
  tier: string;
  lifetimeSpendMinor: number;
  yearsAsMember: number;
}

export interface MigratedCustomer {
  // Same facts as Customer, after a migration - tier is now the value type, not a string.
  tier: LoyaltyTier;
  lifetimeSpendMinor: number;
  yearsAsMember: number;
}

export interface Order {
  amountMinor: number;
  customer: Customer;
}

export class OrderService {
  cancellationFee(order: Order): number {
    // Feature envy: three of the customer's fields, read here instead of asked for.
    const customer = order.customer;
    let discountBps: number;
    if (customer.tier === "gold") discountBps = 2000;
    else if (customer.lifetimeSpendMinor >= 100_000) discountBps = 1000;
    else if (customer.yearsAsMember >= 2) discountBps = 500;
    else discountBps = 0;
    return Math.floor((order.amountMinor * (10_000 - discountBps)) / 10_000);
  }

  loyaltyDiscount(customer: Customer): number {
    // The same interpretation, read again for a receipt line.
    if (customer.tier === "gold") return 2000;
    if (customer.lifetimeSpendMinor >= 100_000) return 1000;
    if (customer.yearsAsMember >= 2) return 500;
    return 0;
  }

  migratedLoyaltyDiscount(customer: MigratedCustomer): number {
    // Customer's tier became a value type - OrderService gained a whole new method just to
    // read it, because the interpretation lives here, not on Customer.
    if (customer.tier === LoyaltyTier.Gold) return 2000;
    if (customer.lifetimeSpendMinor >= 100_000) return 1000;
    if (customer.yearsAsMember >= 2) return 500;
    return 0;
  }
}
