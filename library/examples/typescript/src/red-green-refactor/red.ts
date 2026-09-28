// No rule yet: any status can be cancelled.
export class Order {
  status: string;

  constructor(status = "pending") {
    this.status = status;
  }

  cancel(): void {
    this.status = "cancelled";
  }
}
