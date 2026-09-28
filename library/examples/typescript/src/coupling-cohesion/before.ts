// Teaching artifact: the service reaches into the customer's fields to compute a discount,
// and the rule gets duplicated (and drifts) because nothing owns it but the service.

export interface Customer {
  tier: string;
  lifetimeSpend: number;
  yearsAsMember: number;
}

export interface Order {
  amount: number;
  customer: Customer;
}

export class OrderService {
  cancellationFee(order: Order): number {
    // Feature envy: three of the customer's fields, read here instead of asked for.
    const customer = order.customer;
    let discount: number;
    if (customer.tier === "gold") discount = 0.25;
    else if (customer.lifetimeSpend >= 1000) discount = 0.125;
    else if (customer.yearsAsMember >= 2) discount = 0.0625;
    else discount = 0;
    return order.amount * (1 - discount);
  }

  loyaltyDiscount(customer: Customer): number {
    // The same rule, copied for a receipt line — and it has drifted (`>` vs `>=`).
    if (customer.tier === "gold") return 0.25;
    if (customer.lifetimeSpend > 1000) return 0.125;
    if (customer.yearsAsMember >= 2) return 0.0625;
    return 0;
  }
}
