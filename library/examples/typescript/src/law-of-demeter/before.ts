// Teaching artifact: cancelling an order walks straight through the customer's address and
// wallet to decide how to ship the return and whether to auto-refund — a train wreck that
// breaks the moment one address turns out not to have a country.

export interface Country {
  code: string;
}

export interface Address {
  country: Country | null; // null for a pickup point — no single country's customs apply
}

export interface Card {
  expired: boolean;
}

export interface Wallet {
  card: Card;
}

export interface Customer {
  address: Address;
  wallet: Wallet;
}

export interface Order {
  customer: Customer;
}

export class CancellationPolicy {
  shipsDomestically(order: Order): boolean {
    // Train wreck: order -> customer -> address -> country -> code.
    // The non-null assertion is the tell: the caller assumed a country is always there.
    return order.customer.address.country!.code === "US";
  }

  canAutoRefund(order: Order): boolean {
    // Train wreck: order -> customer -> wallet -> card -> expired.
    return !order.customer.wallet.card.expired;
  }
}
