// Minimal fix: a bare status-string comparison, right where cancel() decides.
export class Order {
  status: string;

  constructor(status = "pending") {
    this.status = status;
  }

  cancel(): void {
    if (this.status === "shipped") throw new Error("a shipped order can't be cancelled");
    this.status = "cancelled";
  }
}
