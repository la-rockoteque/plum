// Each object only talks to its own data or its direct collaborator. Address answers
// "domestic?" for itself whether it still holds a plain country or, after the region
// migration, a Region one hop further out -- so the callers below never learn the new shape.

export class Country {
  constructor(public readonly code: string) {}
}

export class Region {
  constructor(public readonly country: Country) {}

  isDomestic(): boolean {
    return this.country.code === "US";
  }
}

export class Address {
  constructor(
    public readonly country: Country | null,
    public readonly region: Region | null,
  ) {}

  isDomestic(): boolean {
    if (this.region !== null) {
      return this.region.isDomestic();
    }
    if (this.country !== null) {
      return this.country.code === "US";
    }
    return false; // a pickup point has no single country either
  }
}

export class Customer {
  constructor(public readonly address: Address) {}

  canAutoRefund(): boolean {
    return this.address.isDomestic();
  }

  needsCustomsForm(): boolean {
    return !this.address.isDomestic();
  }
}

export class Order {
  constructor(public readonly customer: Customer) {}

  canAutoRefund(): boolean {
    return this.customer.canAutoRefund();
  }

  needsCustomsForm(): boolean {
    return this.customer.needsCustomsForm();
  }
}

export class CancellationPolicy {
  canAutoRefund(order: Order): boolean {
    return order.canAutoRefund();
  }
}

export class ReturnLabelPrinter {
  needsCustomsForm(order: Order): boolean {
    return order.needsCustomsForm();
  }
}
