// Internal only — narrows the values that flow through the rule below. The public constructor and
// `status` field stay `string`, exactly like green.
type OrderStatus = "pending" | "shipped" | "cancelled";

// The rule, named and in one place instead of a bare comparison buried in cancel().
const NON_CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set(["shipped"]);

export class Order {
  status: string;

  constructor(status = "pending") {
    this.status = status;
  }

  canCancel(): boolean {
    return !NON_CANCELLABLE_STATUSES.has(this.status as OrderStatus);
  }

  cancel(): void {
    if (!this.canCancel()) throw new Error("a shipped order can't be cancelled");
    this.status = "cancelled";
  }
}
