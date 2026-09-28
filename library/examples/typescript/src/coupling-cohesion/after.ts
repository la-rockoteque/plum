// Customer answers its own question - what loyalty discount do I get? OrderService only asks,
// through a structural type, so it never cares which representation of Customer answers.

export enum LoyaltyTier {
  Gold = "gold",
  Silver = "silver",
  Bronze = "bronze",
}

export interface DiscountEligible {
  loyaltyDiscount(): number;
}

export class Customer implements DiscountEligible {
  constructor(
    public readonly tier: string,
    public readonly lifetimeSpendMinor: number,
    public readonly yearsAsMember: number,
  ) {}

  // The one place that knows how tier, spend and membership translate into a discount.
  loyaltyDiscount(): number {
    if (this.tier === "gold") return 2000;
    if (this.lifetimeSpendMinor >= 100_000) return 1000;
    if (this.yearsAsMember >= 2) return 500;
    return 0;
  }
}

export class MigratedCustomer implements DiscountEligible {
  // Same question, a different internal shape - tier is the value type, not a string.
  constructor(
    public readonly tier: LoyaltyTier,
    public readonly lifetimeSpendMinor: number,
    public readonly yearsAsMember: number,
  ) {}

  loyaltyDiscount(): number {
    if (this.tier === LoyaltyTier.Gold) return 2000;
    if (this.lifetimeSpendMinor >= 100_000) return 1000;
    if (this.yearsAsMember >= 2) return 500;
    return 0;
  }
}

export interface Order {
  amountMinor: number;
  customer: DiscountEligible;
}

export class OrderService {
  cancellationFee(order: Order): number {
    const discountBps = order.customer.loyaltyDiscount();
    return Math.floor((order.amountMinor * (10_000 - discountBps)) / 10_000);
  }

  loyaltyDiscount(customer: DiscountEligible): number {
    return customer.loyaltyDiscount();
  }
}
