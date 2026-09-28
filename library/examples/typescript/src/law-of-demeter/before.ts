// Teaching artifact: the refund and customs decisions each walk straight through the
// customer's address to read its country -- a train wreck that breaks not by crashing, but by
// silently giving the wrong answer the day the country moves one hop further out.

export interface Country {
  code: string;
}

// Introduced later: countries are grouped under a customs region.
export interface Region {
  country: Country;
}

export interface Address {
  // Exactly one of these is set: `country` for an address created before the region
  // migration, `region` for one created after it. Neither caller below knows about `region`.
  country: Country | null;
  region: Region | null;
}

export interface Customer {
  address: Address;
}

export interface Order {
  customer: Customer;
}

export class CancellationPolicy {
  canAutoRefund(order: Order): boolean {
    // Train wreck: order -> customer -> address -> country -> code.
    const address = order.customer.address;
    if (address.country === null) {
      return false; // play it safe: no auto-refund if we can't read a country
    }
    return address.country.code === "US";
  }
}

export class ReturnLabelPrinter {
  needsCustomsForm(order: Order): boolean {
    // Train wreck: order -> customer -> address -> country -> code.
    const address = order.customer.address;
    if (address.country === null) {
      return true; // play it safe: assume a customs form is needed
    }
    return address.country.code !== "US";
  }
}
