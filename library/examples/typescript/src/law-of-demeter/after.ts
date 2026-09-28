// Each object only talks to its own data or its direct collaborator; the caller asks Order one
// question at a time. A pickup point's missing country is absorbed where it lives, in Address,
// instead of blowing up three hops away.

export class Country {
  constructor(public readonly code: string) {}
}

export class Address {
  constructor(public readonly country: Country | null) {} // null for a pickup point

  isDomestic(): boolean {
    return this.country !== null && this.country.code === "US";
  }
}

export class Card {
  constructor(public readonly expired: boolean) {}

  isExpired(): boolean {
    return this.expired;
  }
}

export class Wallet {
  constructor(public readonly card: Card) {}

  hasValidCard(): boolean {
    return !this.card.isExpired();
  }
}

export class Customer {
  constructor(
    public readonly address: Address,
    public readonly wallet: Wallet,
  ) {}

  shipsDomestically(): boolean {
    return this.address.isDomestic();
  }

  canAutoRefund(): boolean {
    return this.wallet.hasValidCard();
  }
}

export class Order {
  constructor(public readonly customer: Customer) {}

  returnsShipDomestically(): boolean {
    return this.customer.shipsDomestically();
  }

  canAutoRefund(): boolean {
    return this.customer.canAutoRefund();
  }
}

export class CancellationPolicy {
  shipsDomestically(order: Order): boolean {
    return order.returnsShipDomestically();
  }

  canAutoRefund(order: Order): boolean {
    return order.canAutoRefund();
  }
}
