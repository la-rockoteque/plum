// The customer owns the question "what discount do I get?"; the service only asks it.

export class Customer {
  constructor(
    public readonly tier: string,
    public readonly lifetimeSpend: number,
    public readonly yearsAsMember: number,
  ) {}

  // The one place that knows how tier, spend and membership translate into a discount.
  cancellationDiscount(): number {
    if (this.tier === "gold") return 0.25;
    if (this.lifetimeSpend >= 1000) return 0.125;
    if (this.yearsAsMember >= 2) return 0.0625;
    return 0;
  }
}

export interface Order {
  amount: number;
  customer: Customer;
}

export class OrderService {
  cancellationFee(order: Order): number {
    return order.amount * (1 - order.customer.cancellationDiscount());
  }

  loyaltyDiscount(customer: Customer): number {
    return customer.cancellationDiscount();
  }
}
